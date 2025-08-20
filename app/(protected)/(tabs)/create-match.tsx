import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";

// This is a placeholder file for the create-match tab
// The actual navigation is handled in the tab bar icon
export default function CreateMatchTab() {
  const router = useRouter();

  useEffect(() => {
    // Immediately redirect to the actual create match screen
    router.replace("/(protected)/(screens)/create-match");
  }, [router]);

  // Show a brief loading state while redirecting
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" color="#fbbf24" />
    </View>
  );
}
