import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ActivityIndicator, View, Alert } from "react-native";
import * as z from "zod";
import { useState } from "react";
import { router } from "expo-router";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, H2 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";

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
  const { signUp, verifyOtp } = useAuth();
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [generalError, setGeneralError] = useState("");

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
          </>
        )}
      </View>

      {!pendingVerification && (
        <Button
          size="default"
          variant="default"
          onPress={signUpForm.handleSubmit(onSignUpSubmit)}
          disabled={signUpForm.formState.isSubmitting}
          className="web:m-4"
        >
          {signUpForm.formState.isSubmitting ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text>Sign Up</Text>
          )}
        </Button>
      )}
    </SafeAreaView>
  );
}