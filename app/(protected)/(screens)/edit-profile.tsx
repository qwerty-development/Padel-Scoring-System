import React, { useState, useEffect } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from '@/components/safe-area-view';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { H1, H2 } from '@/components/ui/typography';
import { useAuth } from '@/context/supabase-provider';

interface FormData {
  full_name: string;
  age: string;
  nickname: string;
  sex: string;
  preferred_hand: string;
  preferred_area: string;
  court_playing_side: string;
}

export default function EditProfile() {
  const { profile, saveProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    age: '',
    nickname: '',
    sex: '',
    preferred_hand: '',
    preferred_area: '',
    court_playing_side: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        age: profile.age || '',
        nickname: profile.nickname || '',
        sex: profile.sex || '',
        preferred_hand: profile.preferred_hand || '',
        preferred_area: profile.preferred_area || '',
        court_playing_side: profile.court_playing_side || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveProfile(formData);
      router.back();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderAvatar = () => (
    <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-6">
      <Text className="text-4xl font-bold text-primary-foreground">
        {formData.full_name?.charAt(0)?.toUpperCase() || '?'}
      </Text>
    </View>
  );

  const renderInput = (
    label: string, 
    value: string, 
    onChangeText: (text: string) => void,
    placeholder: string = "",
    keyboardType: any = "default",
    icon: keyof typeof Ionicons.glyphMap
  ) => (
    <View className="mb-6">
      <Text className="text-sm font-medium mb-2 text-muted-foreground">{label}</Text>
      <View className="flex-row items-center bg-card border-2 border-border rounded-xl px-4 py-3">
        <Ionicons name={icon} size={20} color="#888" className="mr-3" />
        <TextInput
          className="flex-1 text-foreground text-base ml-3"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#888"
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  const renderSelect = (
    label: string,
    value: string,
    options: string[],
    onSelect: (value: string) => void,
    icon: keyof typeof Ionicons.glyphMap
  ) => (
    <View className="mb-6">
      <Text className="text-sm font-medium mb-2 text-muted-foreground">{label}</Text>
      <View className="flex-row gap-3">
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            className={`flex-1 px-4 py-3 rounded-xl border-2 ${
              value === option 
                ? 'bg-primary border-primary' 
                : 'bg-card border-border'
            }`}
            onPress={() => onSelect(option)}
          >
            <Text className={`text-center font-medium ${
              value === option ? 'text-primary-foreground' : 'text-foreground'
            }`}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (!profile) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">

      <ScrollView className="flex-1 p-6">
        <View className="items-center mb-8">
          {renderAvatar()}
        </View>

        {/* Personal Information Section */}
        <View className="mb-8">
          <H1 className="mb-6">Personal Information</H1>
          {renderInput(
            "Full Name",
            formData.full_name,
            (text) => setFormData(prev => ({ ...prev, full_name: text })),
            "Enter your full name",
            "default",
            "person-outline"
          )}
          {renderInput(
            "Age",
            formData.age,
            (text) => setFormData(prev => ({ ...prev, age: text })),
            "Enter your age",
            "numeric",
            "calendar-outline"
          )}
          {renderInput(
            "Nickname",
            formData.nickname,
            (text) => setFormData(prev => ({ ...prev, nickname: text })),
            "Enter your nickname (optional)",
            "default",
            "star-outline"
          )}
          {renderSelect(
            "Gender",
            formData.sex,
            ["Male", "Female"],
            (value) => setFormData(prev => ({ ...prev, sex: value })),
            "body-outline"
          )}
        </View>

        {/* Playing Preferences Section */}
        <View className="mb-8">
          <H1 className="mb-6">Playing Preferences</H1>
          {renderSelect(
            "Preferred Hand",
            formData.preferred_hand,
            ["Left", "Right"],
            (value) => setFormData(prev => ({ ...prev, preferred_hand: value })),
            "hand-left-outline"
          )}
          {renderSelect(
            "Court Position",
            formData.court_playing_side,
            ["Left", "Right"],
            (value) => setFormData(prev => ({ ...prev, court_playing_side: value })),
            "tennisball-outline"
          )}
          {renderInput(
            "Preferred Area",
            formData.preferred_area,
            (text) => setFormData(prev => ({ ...prev, preferred_area: text })),
            "Enter your preferred area",
            "default",
            "location-outline"
          )}
        </View>

        {/* Save Button */}
        <Button
          className="w-full mb-8"
          size="default"
          variant="default"
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#333" />
          ) : (
            <Text>Save Changes</Text>
          )}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}