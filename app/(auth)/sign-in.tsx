import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { router } from "expo-router";
import * as AppleAuthentication from 'expo-apple-authentication';

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider"; // Ensure this path is correct
import { useColorScheme } from "@/lib/useColorScheme";


// Schema for sign-in form validation
const signInFormSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

export default function SignIn() {
  // Destructure googleSignIn from useAuth
  const { signIn, appleSignIn, googleSignIn } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [error, setError] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Google loading state
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Form for email/password sign-in
  const form = useForm<z.infer<typeof signInFormSchema>>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Check if Apple Authentication is available
  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      if (Platform.OS === 'ios') {
        try {
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          setAppleAuthAvailable(isAvailable);
        } catch {
          setAppleAuthAvailable(false);
        }
      }
    };
    checkAppleAuthAvailability();
  }, []);

  // Handle standard email/password sign-in
  async function onSubmit(data: z.infer<typeof signInFormSchema>) {
    setError("");
    setIsEmailLoading(true);
    try {
      await signIn(data.email, data.password);
      // Navigation is handled by auth provider
    } catch (err: any) {
      console.error("Email sign in error:", err);
      setError(err.message || "Failed to sign in.");
    } finally {
      setIsEmailLoading(false);
    }
  }

  // Handle Apple Sign In
  const handleAppleSignIn = async () => {
    if (!appleAuthAvailable && Platform.OS === 'ios') {
        setError("Apple Sign-In is not available on this device/iOS version.");
        return;
    }
    if (Platform.OS !== 'ios') {
        // This case should ideally not be reachable if button is not shown, but as a fallback.
        setError("Apple Sign-In is only available on iOS devices.");
        return;
    }

    setError("");
    setIsAppleLoading(true);
    try {
      const { error: appleError, needsProfileUpdate } = await appleSignIn(); // Renamed error to appleError
      if (appleError) {
        // Don't show error if user cancelled
        if ((appleError as any)?.code === 'ERR_REQUEST_CANCELED' || appleError.message.toLowerCase().includes('cancel')) {
          console.log("Apple Sign In cancelled by user.");
        } else {
          console.error("Apple sign in error:", appleError);
          setError(appleError.message || "Apple sign in failed.");
        }
      }
      // Navigation and profile completion is handled by auth provider
    } catch (err: any) {
      console.error("Apple sign in error (catch block):", err);
      setError(err.message || "Failed to sign in with Apple.");
    } finally {
      setIsAppleLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setError("");
    setIsGoogleLoading(true);
    try {
      const { error: googleError, needsProfileUpdate, cancelled } = await googleSignIn(); // Renamed error to googleError
      if (cancelled) {
        console.log("Google Sign In cancelled by user.");
      } else if (googleError) {
        console.error("Google sign in error:", googleError);
        setError(googleError.message || "Google sign in failed.");
      }
      // Navigation and profile completion is handled by auth provider
    } catch (err: any) {
      console.error("Google sign in error (catch block):", err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const socialButtonBaseStyle = {
    width: 56,
    height: 56,
    borderRadius: 28, // Makes it a circle
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
    backgroundColor: isDark ? '#27272A' : '#F4F4F5', // zinc-800 dark, zinc-100 light
  };

  const socialButtonDisabledStyle = {
    opacity: 0.6,
  };


  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-1 gap-4 web:m-4">
        <H1 className="self-start native:text-3xl">Sign In</H1>

        <Form {...form}>
          <View className="gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormInput
                  label="Email"
                  placeholder="Email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormInput
                  label="Password"
                  placeholder="Password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  {...field}
                />
              )}
            />
          </View>
        </Form>

        {error && <Text className="text-destructive text-center mt-2">{error}</Text>}

        <Button
          size="default"
          variant="default"
          onPress={form.handleSubmit(onSubmit)}
          disabled={isEmailLoading || isAppleLoading || isGoogleLoading} // Disable if any social login is in progress
          className="mt-4 web:m-4"
        >
          {isEmailLoading ? (
            <ActivityIndicator size="small" color={isDark ? "black" : "white"} />
          ) : (
            <Text>Sign In</Text>
          )}
        </Button>

        {/* Social Sign In Section */}
        <View className="items-center mt-6">
          <View className="flex-row items-center w-full mb-4">
            <View className="flex-1 h-px bg-border" />
            <Text className="mx-4 text-muted-foreground">or continue with</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          <View className="flex-row gap-x-4 justify-center">
            {/* Google Sign In Button */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading || isEmailLoading || isAppleLoading}
              style={[
                socialButtonBaseStyle,
                (isGoogleLoading || isEmailLoading || isAppleLoading) && socialButtonDisabledStyle,
                { backgroundColor: isDark ? '#18181B' : '#FFFFFF' } // Slightly different bg for Google
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Google"
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#1F2937'} />
              ) : (
                <Ionicons name="logo-google" size={26} color={isDark ? '#FFFFFF' : '#1F2937'} />
              )}
            </TouchableOpacity>

            {/* Apple Sign In Button - Conditionally rendered for iOS */}
            {Platform.OS === 'ios' && (
              <View style={{
                ...socialButtonBaseStyle,
                // The Apple button component handles its own styling, so we wrap it.
                // The wrapper ensures consistent size and loading indicator placement.
                // The Apple button itself doesn't accept a disabled prop directly.
                opacity: (isAppleLoading || isEmailLoading || isGoogleLoading || !appleAuthAvailable) ? 0.6 : 1,
              }}>
                {appleAuthAvailable ? (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={isDark
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={28} // Match the wrapper's borderRadius
                    style={{
                      width: 56, // Fixed size for the button itself
                      height: 56,
                    }}
                    onPress={isAppleLoading || isEmailLoading || isGoogleLoading ? () => {} : handleAppleSignIn} // Prevent action if loading
                  />
                ) : (
                  // Fallback display if Apple Auth is not available but still on iOS (e.g. old iOS)
                  // This part might not be strictly necessary if appleAuthAvailable is false,
                  // but provides a disabled visual cue.
                  <View style={[socialButtonBaseStyle, socialButtonDisabledStyle]}>
                     <Ionicons name="logo-apple" size={26} color={isDark ? '#A1A1AA' : '#71717A'} />
                  </View>
                )}
                {(isAppleLoading) && ( // Show loading indicator over the Apple button
                  <View style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 28,
                  }}>
                    <ActivityIndicator size="small" color={isDark ? "#FFFFFF" : "#000000"} />
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        <View className="flex-row justify-center mt-8">
          <Text className="text-muted-foreground">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/sign-up")} disabled={isEmailLoading || isAppleLoading || isGoogleLoading}>
            <Text className="text-primary font-semibold">Sign up</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/forgot-password")}
          className="mt-4 self-center"
          disabled={isEmailLoading || isAppleLoading || isGoogleLoading}
        >
          <Text className="text-muted-foreground underline">Forgot Password?</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
