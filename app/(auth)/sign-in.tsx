import React, { useState, useEffect, useCallback } from "react";
import { View, ActivityIndicator, TouchableOpacity, Platform } from "react-native";
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
import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";


// Schema for sign-in form validation
const signInFormSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

export default function SignIn() {
  const { signIn, appleSignIn } = useAuth(); 
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  
  const [error, setError] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Add Google loading state
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
      console.error(err);
      setError(err.message || "Failed to sign in.");
    } finally {
      setIsEmailLoading(false);
    }
  }

  // Handle Apple Sign In
  const handleAppleSignIn = async () => {
    setError("");
    setIsAppleLoading(true);
    
    try {
      const { error, needsProfileUpdate } = await appleSignIn();
      
      if (error) {
        if (error.message !== 'User canceled Apple sign-in') {
          setError(error.message || "Apple sign in failed.");
        }
      }
      
      // Navigation and profile completion is handled by auth provider
    } catch (err: any) {
      console.error("Apple sign in error:", err);
      setError(err.message || "Failed to sign in with Apple.");
    } finally {
      setIsAppleLoading(false);
    }
  };



  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-1 gap-4 web:m-4">
        <H1 className="self-start">Sign In</H1>
        
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
        
        {error && <Text className="text-destructive text-center">{error}</Text>}
        
        <Button
          size="default"
          variant="default"
          onPress={form.handleSubmit(onSubmit)}
          disabled={isEmailLoading}
          className="web:m-4"
        >
          {isEmailLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text>Sign In</Text>
          )}
        </Button>
        
        {/* Social Sign In Section */}
        <View className="items-center mt-6">
          <View className="flex-row items-center w-full mb-4">
            <View className="flex-1 h-0.5 bg-muted" />
            <Text className="mx-4 text-muted-foreground">or continue with</Text>
            <View className="flex-1 h-0.5 bg-muted" />
          </View>
          
          <View className="flex-row gap-4">
            {/* Apple Sign In Button */}
            {(Platform.OS === 'ios' && appleAuthAvailable) ? (
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={isDark 
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={28}
                  style={{
                    width: 56,
                    height: 56,
                  }}
                  onPress={handleAppleSignIn}
                />
                {isAppleLoading && (
                  <View style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 28,
                  }}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleAppleSignIn}
                disabled={isAppleLoading || !appleAuthAvailable}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  opacity: appleAuthAvailable ? 1 : 0.5,
                }}
              >
                {isAppleLoading ? (
                  <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
                ) : (
                  <Ionicons name="logo-apple" size={24} color={isDark ? '#fff' : '#000'} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View className="flex-row justify-center mt-4">
          <Text className="text-muted-foreground">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/sign-up")}>
            <Text className="text-primary font-semibold">Sign up</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          onPress={() => router.push("/forgot-password")}
          className="mt-2 self-center"
        >
          <Text className="text-foreground underline">Forgot Password?</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}