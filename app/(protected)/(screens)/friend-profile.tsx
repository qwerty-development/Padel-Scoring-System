import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { SafeAreaView } from '@/components/safe-area-view';
import { useAuth } from "@/context/supabase-provider";
import { supabase } from '@/config/supabase';

interface FriendProfile {
  id: string;
  email: string;
  full_name: string | null;
  age: string | null;
  nickname: string | null;
  sex: string | null;
  preferred_hand: string | null;
  preferred_area: string | null;
  glicko_rating: string | null;
  glicko_rd: string | null;
  glicko_vol: string | null;
  court_playing_side: string | null;
  avatar_url: string | null;
}

export default function FriendProfileScreen() {
  const { friendId } = useLocalSearchParams();
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { session } = useAuth();

  useEffect(() => {
    if (friendId) {
      fetchFriendProfile(friendId as string);
    }
  }, [friendId]);

  const fetchFriendProfile = async (id: string) => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching friend profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (friendId) {
      fetchFriendProfile(friendId as string);
    }
  };

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
            {profile?.glicko_rating || '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Glicko Rating</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">
            {profile?.glicko_rd || '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Rating Deviation</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">
            {profile?.glicko_vol || '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Volatility</Text>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-background p-6">
        <View className="flex-row items-center mb-6">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#fbbf24" />
          </Button>
          <H1>Profile Not Found</H1>
        </View>
        <Text>Could not find the profile you're looking for.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#fbbf24"]}
            tintColor="#fbbf24"
          />
        }
      >
        {/* Header with back button */}
        <View className="px-6 pt-4 flex-row items-center">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#fbbf24" />
          </Button>
          <Text className="text-lg font-medium">Friend Profile</Text>
        </View>

        {/* Profile Header */}
        <View className="pt-4 pb-8 px-6 items-center">
          {renderAvatar()}
          <H1 className="mb-1 text-center">{profile.full_name || 'Anonymous Player'}</H1>
          {profile.nickname && (
            <H2 className="text-muted-foreground text-center">"{profile.nickname}"</H2>
          )}
        </View>

        {/* Content */}
        <View className="px-6 pb-8">
          {/* Stats Card */}
          {renderStatsCard()}

          {/* Personal Info Section */}
          <H3 className="mb-4">Personal Information</H3>
          {renderInfoCard("Age", profile.age, "person-outline")}
          {renderInfoCard("Gender", profile.sex, "body-outline")}
          {renderInfoCard("Email", profile.email, "mail-outline")}

          {/* Playing Preferences Section */}
          <H3 className="mb-4 mt-6">Playing Preferences</H3>
          {renderInfoCard("Preferred Hand", profile.preferred_hand, "hand-left-outline")}
          {renderInfoCard("Court Position", profile.court_playing_side, "tennisball-outline")}
          {renderInfoCard("Preferred Area", profile.preferred_area, "location-outline")}

          {/* Actions */}
          <View className="mt-8 mb-4">
            <Button
              className="w-full"
              size="default"
              variant="default"
              onPress={() => {
                router.push({
                  pathname: '/(protected)/(screens)/create-match',
                  params: { friendId: profile.id }
                });
              }}
            >
              <Text>Challenge to Match</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}