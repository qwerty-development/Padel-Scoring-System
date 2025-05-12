/* eslint-disable prettier/prettier */
import "../global.css";

import * as Updates from 'expo-updates';
import { useEffect } from "react";
import { Stack } from "expo-router";
import { AuthProvider } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

export default function AppLayout() {
  const { colorScheme } = useColorScheme();

  // Add update checking logic
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        console.log("Checking for updates...");
        const update = await Updates.checkForUpdateAsync();
        
        if (update.isAvailable) {
          console.log("Update available, downloading...");
          await Updates.fetchUpdateAsync();
          
          // Alert user before reloading
          alert("An update has been downloaded. The app will now restart to apply changes.");
          await Updates.reloadAsync();
        } else {
          console.log("No updates available or compatible");
        }
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    };

    // Only check in production environments
    if (!__DEV__) {
      checkForUpdates();
    }
  }, []);
	return (
		<AuthProvider>
			<Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
				<Stack.Screen name="(protected)" />
				<Stack.Screen name="welcome" />
				<Stack.Screen
					name="(auth)/sign-up"
					options={{
						headerShown: false,
						headerTitle: "Sign Up",
						headerStyle: {
							backgroundColor:
								colorScheme === "dark"
									? colors.dark.background
									: colors.light.background,
						},
						headerTintColor:
							colorScheme === "dark"
								? colors.dark.foreground
								: colors.light.foreground,
						gestureEnabled: true,
					}}
				/>
				<Stack.Screen
					name="(auth)/sign-in"
					options={{
						headerShown: false,
						headerTitle: "Sign In",
						headerStyle: {
							backgroundColor:
								colorScheme === "dark"
									? colors.dark.background
									: colors.light.background,
						},
						headerTintColor:
							colorScheme === "dark"
								? colors.dark.foreground
								: colors.light.foreground,
						gestureEnabled: true,
					}}
				/>
				<Stack.Screen
					name="(auth)/forgot-password"
					options={{
						headerShown: false,
						headerTitle: "Forgot Password",
						headerStyle: {
							backgroundColor:
								colorScheme === "dark"
									? colors.dark.background
									: colors.light.background,
						},
						headerTintColor:
							colorScheme === "dark"
								? colors.dark.foreground
								: colors.light.foreground,
						gestureEnabled: true,
					}}
				/>
			</Stack>
		</AuthProvider>
	);
}
