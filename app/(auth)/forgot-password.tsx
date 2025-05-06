import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { ActivityIndicator, Alert, View, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from "react-native";
import * as z from "zod";
import { router } from "expo-router";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, H2 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";

// Schema for the email request form
const emailFormSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

// Schema for the password reset form
const resetFormSchema = z.object({
  code: z
    .string()
    .min(6, "Verification code must be at least 6 characters.")
    .regex(/^\d+$/, "Verification code must contain only numbers."),
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
  confirmPassword: z
    .string()
    .min(8, "Please enter at least 8 characters."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Your passwords do not match.",
  path: ["confirmPassword"],
});

export default function ForgotPassword() {
  const { resetPassword, updatePassword } = useAuth();
  const [stage, setStage] = useState<'request' | 'reset'>('request');
  const [verificationEmail, setVerificationEmail] = useState("");
  const [generalError, setGeneralError] = useState("");

  // Form for email request stage
  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: "",
    },
  });

  // Form for password reset stage
  const resetForm = useForm<z.infer<typeof resetFormSchema>>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: {
      code: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Handle the email request form submission
  async function onEmailSubmit(data: z.infer<typeof emailFormSchema>) {
    try {
      setGeneralError("");
      const { error } = await resetPassword(data.email);

      if (error) {
        setGeneralError(error.message || "Failed to request password reset. Please try again.");
        return;
      }

      // Save the email for the reset stage
      setVerificationEmail(data.email);
      
      // Alert the user and switch to reset stage
      Alert.alert(
        "Verification Code Sent",
        "Please check your email for a verification code to reset your password.",
        [{ text: "OK" }]
      );
      
      setStage('reset');
    } catch (error: any) {
      console.error(error.message);
      setGeneralError(error.message || "Failed to request password reset. Please try again.");
    }
  }

  // Handle the password reset form submission
  async function onResetSubmit(data: z.infer<typeof resetFormSchema>) {
    try {
      setGeneralError("");
      const { error } = await updatePassword(
        verificationEmail,
        data.code,
        data.password
      );

      if (error) {
        setGeneralError(error.message || "Failed to reset password. Please try again.");
        return;
      }

      // Alert the user of success and navigate to sign-in
      Alert.alert(
        "Success",
        "Your password has been reset successfully.",
        [
          {
            text: "Sign In",
            onPress: () => router.replace("/sign-in"),
          },
        ]
      );
    } catch (error: any) {
      console.error(error.message);
      setGeneralError(error.message || "Failed to reset password. Please try again.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }} 
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 gap-4 web:m-4">
            <H1 className="self-start">
              {stage === 'request' ? "Forgot Password" : "Reset Password"}
            </H1>
            
            {stage === 'request' ? (
              <>
                <Text className="text-muted-foreground mb-4">
                  Enter your email address and we'll send you a verification code to reset your password.
                </Text>
                
                <Form {...emailForm}>
                  <View className="gap-4">
                    <FormField
                      control={emailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormInput
                          label="Email"
                          placeholder="Enter your email address"
                          autoCapitalize="none"
                          autoComplete="email"
                          autoCorrect={false}
                          keyboardType="email-address"
                          {...field}
                        />
                      )}
                    />
                  </View>
                </Form>
                
                {generalError ? (
                  <Text className="text-destructive">{generalError}</Text>
                ) : null}
                
                <View className="mt-auto">
                  <Button
                    size="default"
                    variant="default"
                    onPress={emailForm.handleSubmit(onEmailSubmit)}
                    disabled={emailForm.formState.isSubmitting}
                    className="web:m-4 mb-4"
                  >
                    {emailForm.formState.isSubmitting ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Text>Send Reset Code</Text>
                    )}
                  </Button>
                  
              
                </View>
              </>
            ) : (
              <>
                <Text className="text-muted-foreground mb-4">
                  Enter the verification code sent to {verificationEmail} and create a new password.
                </Text>
                
                <Form {...resetForm}>
                  <View className="gap-4">
                    <FormField
                      control={resetForm.control}
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
                    
                    <FormField
                      control={resetForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormInput
                          label="New Password"
                          placeholder="Enter new password"
                          autoCapitalize="none"
                          autoCorrect={false}
                          secureTextEntry
                          {...field}
                        />
                      )}
                    />
                    
                    <FormField
                      control={resetForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormInput
                          label="Confirm Password"
                          placeholder="Confirm new password"
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
                
                <View className="mt-auto">
                  <Button
                    size="default"
                    variant="default"
                    onPress={resetForm.handleSubmit(onResetSubmit)}
                    disabled={resetForm.formState.isSubmitting}
                    className="web:m-4 mb-4"
                  >
                    {resetForm.formState.isSubmitting ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Text>Reset Password</Text>
                    )}
                  </Button>
                  
                  <Button
                    size="default"
                    variant="outline"
                    onPress={() => setStage('request')}
                    className="web:m-4"
                  >
                    <Text>Back to Email Entry</Text>
                  </Button>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}