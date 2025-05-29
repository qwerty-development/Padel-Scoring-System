import React, { useState, useEffect } from "react";
import { ActivityIndicator, View, Alert, TouchableOpacity, Platform } from "react-native";
import { router } from "expo-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from "@expo/vector-icons";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";

// Schema for the sign-up form
const signUpFormSchema = z
  .object({
    email: z.string().email("Please enter a valid email address."),
    password: z
      .string()
      .min(8, "Please enter at least 8 characters.")
      .max(64, "Please enter fewer than 64 characters.")
      .regex(
        /^(?=.*[a-z])/,
        "Your password must have at least one lowercase letter.",
      )
      .regex(
        /^(?=.*[A-Z])/,
        "Your password must have at least one uppercase letter.",
      )
      .regex(/^(?=.*[0-9])/, "Your password must have at least one number.")
      .regex(
        /^(?=.*[!@#$%^&*])/,
        "Your password must have at least one special character.",
      ),
    confirmPassword: z.string().min(8, "Please enter at least 8 characters."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Your passwords do not match.",
    path: ["confirmPassword"],
  });

// Schema for the verification form
const verificationFormSchema = z.object({
  code: z
    .string()
    .min(6, "Verification code must be 6 digits.")
    .max(6, "Verification code must be 6 digits.")
    .regex(/^\d+$/, "Verification code must contain only numbers."),
});

export default function SignUp() {
  const { signUp, verifyOtp, appleSignIn, googleSignIn } = useAuth(); 
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

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

  // Form for sign-up step
  const signUpForm = useForm<z.infer<typeof signUpFormSchema>>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Form for verification step
  const verificationForm = useForm<z.infer<typeof verificationFormSchema>>({
    resolver: zodResolver(verificationFormSchema),
    defaultValues: {
      code: "",
    },
  });

  // Handle Apple Sign In
  const handleAppleSignIn = async () => {
    setGeneralError("");
    setIsAppleLoading(true);
    
    try {
      const { error, needsProfileUpdate } = await appleSignIn();
      
      if (error) {
        if (error.message !== 'User canceled Apple sign-in') {
          setGeneralError(error.message || "Apple sign in failed.");
        }
      }
      
      // Navigation and profile completion is handled by auth provider
    } catch (err: any) {
      console.error("Apple sign in error:", err);
      setGeneralError(err.message || "Failed to sign in with Apple.");
    } finally {
      setIsAppleLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setGeneralError("");
    setIsGoogleLoading(true);
    
    try {
      const { error, needsProfileUpdate } = await googleSignIn();
      
      if (error) {
        if (error.message !== 'User canceled Google sign-in') {
          setGeneralError(error.message || "Google sign in failed.");
        }
      }
      
      // Navigation and profile completion is handled by auth provider
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setGeneralError(err.message || "Failed to sign in with Google.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Handle sign-up form submission
  async function onSignUpSubmit(data: z.infer<typeof signUpFormSchema>) {
    try {
      setGeneralError("");
      const { error, needsEmailVerification, email } = await signUp(
        data.email,
        data.password
      );

      if (error) {
        // Check for specific email-exists errors
        if (
          error.message.includes("already exists") ||
          error.message.includes("already registered") ||
          error.message.includes("already in use")
        ) {
          signUpForm.setError("email", {
            type: "manual",
            message: "This email is already registered. Please try signing in.",
          });
        } else {
          // Other errors set as general error
          setGeneralError(error.message || "Sign up failed. Please try again.");
        }
        return;
      }

      if (needsEmailVerification) {
        setVerificationEmail(email || data.email);
        setPendingVerification(true);
        signUpForm.reset();
        Alert.alert(
          "Verification Code Sent",
          "Please check your email for a verification code to complete your registration.",
          [{ text: "OK" }]
        );
      } else {
        // If email verification not required, registration is complete
        signUpForm.reset();
        router.replace("/(protected)/(tabs)");
      }
    } catch (error: any) {
      console.error(error.message);
      setGeneralError(error.message || "Sign up failed. Please try again.");
    }
  }

  // Handle verification form submission
  async function onVerificationSubmit(data: z.infer<typeof verificationFormSchema>) {
    try {
      setGeneralError("");
      const { error } = await verifyOtp(verificationEmail, data.code);

      if (error) {
        verificationForm.setError("code", {
          type: "manual",
          message: error.message || "Invalid verification code. Please try again.",
        });
        return;
      }

      Alert.alert(
        "Success",
        "Your account has been verified successfully.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(protected)/(tabs)"),
          },
        ]
      );
    } catch (error: any) {
      console.error(error.message);
      setGeneralError(error.message || "Verification failed. Please try again.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-1 gap-4 web:m-4">
        <H1 className="self-start">
          {pendingVerification ? "Verify Email" : "Sign Up"}
        </H1>

        {pendingVerification ? (
          // Verification Form
          <>
            <Text className="text-muted-foreground mb-4">
              We've sent a verification code to {verificationEmail}.
              Please enter it below to complete your registration.
            </Text>
            <Form {...verificationForm}>
              <View className="gap-4">
                <FormField
                  control={verificationForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormInput
                      label="Verification Code"
                      placeholder="Enter 6-digit code"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="number-pad"
                      maxLength={6}
                      {...field}
                    />
                  )}
                />
              </View>
            </Form>
            {generalError ? (
              <Text className="text-destructive">{generalError}</Text>
            ) : null}
            <View className="mt-4">
              <Button
                size="default"
                variant="default"
                onPress={verificationForm.handleSubmit(onVerificationSubmit)}
                disabled={verificationForm.formState.isSubmitting}
                className="mb-4"
              >
                {verificationForm.formState.isSubmitting ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text>Verify Email</Text>
                )}
              </Button>
              <Button
                size="default"
                variant="outline"
                onPress={() => setPendingVerification(false)}
              >
                <Text>Go Back</Text>
              </Button>
            </View>
          </>
        ) : (
          // Sign Up Form
          <>
            <Form {...signUpForm}>
              <View className="gap-4">
                <FormField
                  control={signUpForm.control}
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
                  control={signUpForm.control}
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
                <FormField
                  control={signUpForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormInput
                      label="Confirm Password"
                      placeholder="Confirm password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      {...field}
                    />
                  )}
                />
              </View>
            </Form>
            {generalError ? (
              <Text className="text-destructive">{generalError}</Text>
            ) : null}
            
            <Button
              size="default"
              variant="default"
              onPress={signUpForm.handleSubmit(onSignUpSubmit)}
              disabled={signUpForm.formState.isSubmitting}
              className="web:m-4 mt-4"
            >
              {signUpForm.formState.isSubmitting ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text>Sign Up</Text>
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
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
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
                
                {/* Google Sign In Button */}
                <TouchableOpacity
                  onPress={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  {isGoogleLoading ? (
                    <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
                  ) : (
                    <Ionicons name="logo-google" size={24} color={isDark ? '#fff' : '#000'} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row justify-center mt-4">
              <Text className="text-muted-foreground">Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/sign-in")}>
                <Text className="text-primary font-semibold">Sign in</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}