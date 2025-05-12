import React from "react";
import { TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/lib/useColorScheme";

interface GoogleSignInButtonProps {
  onPress: () => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ 
  onPress, 
  isLoading,
  disabled = false
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading || disabled}
      style={[
        styles.button,
        {
          backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          opacity: disabled ? 0.5 : 1,
        }
      ]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
      ) : (
        <Ionicons name="logo-google" size={24} color={isDark ? '#fff' : '#000'} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});

export default GoogleSignInButton;