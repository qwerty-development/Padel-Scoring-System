/* eslint-disable prettier/prettier */
 
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/supabase-provider";
import { View } from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";


export const unstable_settings = {
	initialRouteName: "(tabs)",
};

export default function ProtectedLayout() {
	const { initialized, session, isProfileComplete } = useAuth(); 
	const { colorScheme } = useColorScheme();

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
		<View className={`flex-1 ${colorScheme === "dark" ? "bg-gray-900" : "bg-white"}`}>
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
		</View>
	  );
	}
  
	
  
	