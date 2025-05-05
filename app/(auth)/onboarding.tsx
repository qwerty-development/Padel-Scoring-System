import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from "@/components/safe-area-view";
import { useAuth } from '@/context/supabase-provider';

interface ProfileData {
  full_name: string;
  age: string;
  nickname: string;
  sex: string;
  preferred_hand: string;
  preferred_area: string;
  court_playing_side: string;
}

const ProfileOnboarding = () => {
  const [step, setStep] = useState(1);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    age: '',
    nickname: '',
    sex: '',
    preferred_hand: '',
    preferred_area: '',
    court_playing_side: '',
  });

  const { saveProfile } = useAuth();

  const updateProfile = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      await saveProfile({
        full_name: profileData.full_name,
        age: profileData.age,
        nickname: profileData.nickname,
        sex: profileData.sex,
        preferred_hand: profileData.preferred_hand,
        preferred_area: profileData.preferred_area,
        court_playing_side: profileData.court_playing_side,
      });
      
      // Navigation will be handled automatically by AuthProvider
      alert('Your padel profile has been created successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View className="space-y-6">
            <View>
              <Text className="text-2xl font-bold mb-6 text-foreground">
                Personal Information
              </Text>
              
              <View className="mb-6">
                <Text className="text-sm font-medium mb-2 text-foreground">
                  Full Name
                </Text>
                <TextInput
                  className="block w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground font-medium placeholder:text-muted-foreground"
                  value={profileData.full_name}
                  onChangeText={(text) => updateProfile('full_name', text)}
                  placeholder="Enter your full name"
                  placeholderTextColor="#888"
                />
              </View>

              <View className="mb-6">
                <Text className="text-sm font-medium mb-2 text-foreground">
                  Age
                </Text>
                <TextInput
                  className="block w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground font-medium placeholder:text-muted-foreground"
                  value={profileData.age}
                  onChangeText={(text) => updateProfile('age', text)}
                  placeholder="Enter your age"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                />
              </View>

              <View className="mb-6">
                <Text className="text-sm font-medium mb-2 text-foreground">
                  Nickname (optional)
                </Text>
                <TextInput
                  className="block w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground font-medium placeholder:text-muted-foreground"
                  value={profileData.nickname}
                  onChangeText={(text) => updateProfile('nickname', text)}
                  placeholder="Enter your nickname"
                  placeholderTextColor="#888"
                />
              </View>
            </View>
          </View>
        );

      case 2:
        return (
          <View className="space-y-6">
            <Text className="text-2xl font-bold mb-6 text-foreground">
              Player Details
            </Text>
            
            <View className="mb-6">
              <Text className="text-sm font-medium mb-3 text-foreground">
                Sex
              </Text>
              <View className="grid grid-cols-2 gap-4">
                {(['Male', 'Female'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    className={`px-6 py-4 rounded-xl font-bold transition-colors border-2 ${
                      profileData.sex === option 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-card text-foreground border-border'
                    }`}
                    onPress={() => updateProfile('sex', option)}
                  >
                    <Text className={`text-center font-bold ${
                      profileData.sex === option ? 'text-primary-foreground' : 'text-foreground'
                    }`}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium mb-3 text-foreground">
                Preferred Hand
              </Text>
              <View className="grid grid-cols-2 gap-4">
                {(['Left', 'Right'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    className={`px-6 py-4 rounded-xl font-bold transition-colors border-2 ${
                      profileData.preferred_hand === option 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-card text-foreground border-border'
                    }`}
                    onPress={() => updateProfile('preferred_hand', option)}
                  >
                    <Text className={`text-center font-bold ${
                      profileData.preferred_hand === option ? 'text-primary-foreground' : 'text-foreground'
                    }`}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );

      case 3:
        return (
          <View className="space-y-6">
            <Text className="text-2xl font-bold mb-6 text-foreground">
              Playing Preferences
            </Text>
            
            <View className="mb-6">
              <Text className="text-sm font-medium mb-2 text-foreground">
                Preferred Area
              </Text>
              <TextInput
                className="block w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground font-medium placeholder:text-muted-foreground"
                value={profileData.preferred_area}
                onChangeText={(text) => updateProfile('preferred_area', text)}
                placeholder="e.g., Manhattan, Brooklyn"
                placeholderTextColor="#888"
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium mb-3 text-foreground">
                Court Playing Side
              </Text>
              <View className="grid grid-cols-2 gap-4">
                {(['Left', 'Right'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    className={`px-6 py-4 rounded-xl font-bold transition-colors border-2 ${
                      profileData.court_playing_side === option 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-card text-foreground border-border'
                    }`}
                    onPress={() => updateProfile('court_playing_side', option)}
                  >
                    <Text className={`text-center font-bold ${
                      profileData.court_playing_side === option ? 'text-primary-foreground' : 'text-foreground'
                    }`}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="px-6 py-12">
          {/* Progress Bar */}
          <View className="mb-12">
            <Text className="text-3xl font-bold mb-8 text-foreground">
              Complete Your Profile
            </Text>
            <View className="flex-row gap-2 mb-3">
              {[1, 2, 3].map((n) => (
                <View
                  key={n}
                  className={`h-1 rounded-full flex-1 ${
                    step >= n ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </View>
            <Text className="text-sm text-center text-muted-foreground">
              Step {step} of 3
            </Text>
          </View>

          {/* Form Content */}
          <View className="mb-12">
            {renderStep()}
          </View>
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View className="flex-row gap-4 px-6 pb-6">
        {step > 1 && (
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold bg-secondary transition-colors"
            onPress={handleBack}
          >
            <Ionicons name="chevron-back" size={20} color="#333" />
            <Text className="text-foreground font-bold">Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          className={`px-6 py-4 rounded-xl font-bold flex-row items-center justify-center gap-2 bg-primary transition-colors ${
            step === 1 ? 'flex-1' : 'flex-1'
          }`}
          onPress={handleNext}
        >
          <Text className="text-primary-foreground font-bold">
            {step === 3 ? 'Complete' : 'Next'}
          </Text>
          {step < 3 && (
            <Ionicons name="chevron-forward" size={20} color="#333" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ProfileOnboarding;