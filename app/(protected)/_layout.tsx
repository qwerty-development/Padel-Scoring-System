import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/context/supabase-provider";
import { LogBox } from "react-native";

LogBox.ignoreAllLogs();

export const unstable_settings = {
	initialRouteName: "(tabs)",
};

export default function ProtectedLayout() {
	const { initialized, session, isProfileComplete } = useAuth();
  
	if (!initialized) {
	  return null;
	}
  
	if (!session) {
	  return <Redirect href="/welcome" />;
	}
  
	// Add this check to prevent redirection to tabs if profile is incomplete
	if (!isProfileComplete) {
	  return <Redirect href="/onboarding" />;
	}
  
	return (
	  <Stack
		screenOptions={{
		  headerShown: false,
		}}
	  >
		<Stack.Screen name="(tabs)" />
		<Stack.Screen name="modal" options={{ presentation: "modal" }} />
		<Stack.Screen name="(screens)/friends" />
		<Stack.Screen name="(screens)/friend-profile" />
		<Stack.Screen name="(screens)/create-match" />
		<Stack.Screen name="(screens)/match-history" />
		<Stack.Screen name="(screens)/match-details" />
		<Stack.Screen name="(screens)/leaderboard" />
		<Stack.Screen name="(screens)/edit-match" />
	  </Stack>
	);
  }