import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ActivityIndicator, View, Alert } from "react-native";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useRouter } from "expo-router";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z
    .string()
    // .min(8, "Please enter at least 8 characters.")
    .max(64, "Please enter fewer than 64 characters."),
});

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      await signIn(data.email, data.password);
      form.reset();
    } catch (error: Error | any) {
      console.error(error.message);
      
      // Show user-friendly error messages
      let errorMessage = "Failed to sign in. Please try again.";
      
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password.";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "Please confirm your email before signing in.";
      } else if (error.message.includes("Too many requests")) {
        errorMessage = "Too many attempts. Please try again later.";
      }
      
      Alert.alert("Error", errorMessage);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-1 gap-6 web:m-4">
        <View className="gap-2">
          <H1 className="self-start text-foreground">Sign In</H1>
          <P className="text-muted-foreground">
            Welcome back! Please enter your credentials.
          </P>
        </View>
        
        <Form {...form}>
          <View className="gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormInput
                  label="Email"
                  placeholder="Enter your email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  {...field}
                  error={form.formState.errors.email}
                />
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormInput
                  label="Password"
                  placeholder="Enter your password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  {...field}
                  error={form.formState.errors.password}
                />
              )}
            />
          </View>
        </Form>
        
        <View className="gap-2">
          <Button
            size="default"
            variant="link"
            className="self-start p-0"
            onPress={() => {
        router.push("/forgot-password")
            }}
          >
            <Text className="text-primary">Forgot password?</Text>
          </Button>
        </View>
      </View>
      
      <View className="gap-4 web:m-4">
        <Button
          size="default"
          variant="default"
          onPress={form.handleSubmit(onSubmit)}
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <ActivityIndicator size="small" className="text-primary-foreground" />
          ) : (
            <Text>Sign In</Text>
          )}
        </Button>
        
        <Button
          size="default"
          variant="outline"
          onPress={() => {
            // Navigate to sign up screen
            console.log("Navigate to sign up");
          }}
        >
          <Text>Create Account</Text>
        </Button>

  
      </View>
    </SafeAreaView>
  );
}