import "../global.css";
import {decode, encode} from 'base-64';
import { LogBox } from "react-native";
import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { AppState } from "react-native";
import { AuthProvider } from "@/context/supabase-provider";
import { NotificationProvider } from "@/context/notification-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { runConfirmationProcessor } from "@/services/confirmation-processor.service";


LogBox.ignoreAllLogs();

if (!global.btoa) {
    global.btoa = encode;
}

if (!global.atob) {
    global.atob = decode;
}

export default function AppLayout() {
  const { colorScheme } = useColorScheme();
  const appState = useRef(AppState.currentState);

  // Enhanced update checking logic with diagnostics
  const checkForUpdates = async (source: string) => {
    if (__DEV__) return;

    try {
      // Diagnostic information
      console.log(`[EAS Update] Check triggered from: ${source}`);
      console.log(`[EAS Update] Channel: ${Updates.channel || "unknown"}`);
      console.log(
        `[EAS Update] Runtime version: ${Updates.runtimeVersion || "unknown"}`,
      );
      console.log(`[EAS Update] Update ID: ${Updates.updateId || "none"}`);

      // Check for update
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        console.log("[EAS Update] Update available, downloading...");
        await Updates.fetchUpdateAsync();

        // Alert user before reloading
        alert(
          "An update has been downloaded. The app will now restart to apply changes.",
        );
        await Updates.reloadAsync();
      } else {
        console.log("[EAS Update] No updates available or compatible");
      }
    } catch (error: any) {
      // Enhanced error logging
      console.error("[EAS Update] Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        source,
      });
    }
  };

  useEffect(() => {
    // Initial update check
    checkForUpdates("app-launch");

    // Set up AppState listener for background-to-foreground transitions
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        checkForUpdates("background-to-foreground");
      }

      appState.current = nextAppState;
    });

    // Clean up subscription
    return () => {
      subscription.remove();
    };
  }, []);

runConfirmationProcessor();

  return (
    <AuthProvider>
      <NotificationProvider>
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
                    ? colors.dark.card
                    : colors.light.card,
              },
              headerTintColor:
                colorScheme === "dark"
                  ? colors.dark.foreground
                  : colors.light.foreground,
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
                    ? colors.dark.card
                    : colors.light.card,
              },
              headerTintColor:
                colorScheme === "dark"
                  ? colors.dark.foreground
                  : colors.light.foreground,
            }}
          />
          <Stack.Screen
            name="(auth)/onboarding"
            options={{
              headerShown: false,
              headerTitle: "Profile Setup",
              headerStyle: {
                backgroundColor:
                  colorScheme === "dark"
                    ? colors.dark.card
                    : colors.light.card,
              },
              headerTintColor:
                colorScheme === "dark"
                  ? colors.dark.foreground
                  : colors.light.foreground,
            }}
          />
        </Stack>
      </NotificationProvider>
    </AuthProvider>
  );
}