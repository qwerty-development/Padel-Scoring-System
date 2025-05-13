/* eslint-disable prettier/prettier */
import {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useState,
} from "react";
import { SplashScreen, useRouter } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import PadelLoadingScreen from "@/components/PadelLoadingScreen";
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import Constants from "expo-constants"

SplashScreen.preventAutoHideAsync();

// Define the UserProfile type
export interface UserProfile {
	id: string;
	email: string;
	full_name: string | null;
	age: string | null;
	nickname: string | null;
	sex: string | null;
	preferred_hand: string | null;
	preferred_area: string | null;
	glicko_rating: number | null;
	glicko_rd: number | null;
	glicko_vol: number | null;
	friends_list: string | null;
	court_playing_side: string | null;
	avatar_url: string | null;
	created_at: string;
}

type AuthState = {
	initialized: boolean;
	session: Session | null;
	profile: UserProfile | null;
	isProfileComplete: boolean;
	signUp: (email: string, password: string) => Promise<{
		error?: Error;
		needsEmailVerification?: boolean;
		email?: string;
	}>;
	signIn: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
	saveProfile: (profileData: Partial<UserProfile>) => Promise<void>;
	verifyOtp: (email: string, otp: string) => Promise<{
		error?: Error;
		data?: any;
	}>;
	resetPassword: (email: string) => Promise<{
		error?: Error;
	}>;
	updatePassword: (email: string, code: string, newPassword: string) => Promise<{
		error?: Error;
	}>;
	// Add apple sign in method
	appleSignIn: () => Promise<{
		error?: Error;
		needsProfileUpdate?: boolean;
	}>;
	// Add Google sign in method
	googleSignIn: () => Promise<{
		error?: Error;
		needsProfileUpdate?: boolean;
	}>;
};

export const AuthContext = createContext<AuthState>({
	initialized: false,
	session: null,
	profile: null,
	isProfileComplete: false,
	signUp: async () => ({}),
	signIn: async () => {},
	signOut: async () => {},
	saveProfile: async () => {},
	verifyOtp: async () => ({}),
	resetPassword: async () => ({}),
	updatePassword: async () => ({}),
	appleSignIn: async () => ({}),
	googleSignIn: async () => ({}),
});

export const useAuth = () => useContext(AuthContext);

const resetPassword = async (email: string) => {
	try {
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: null, // Don't redirect, we'll handle verification with OTP
		});

		if (error) {
			console.error("Error requesting password reset:", error);
			return { error };
		}

		return { error: null };
	} catch (error) {
		console.error("Error requesting password reset:", error);
		return { error: error as Error };
	}
};

const updatePassword = async (email: string, code: string, newPassword: string) => {
	try {
		// First verify the OTP
		const { data, error } = await supabase.auth.verifyOtp({
			email,
			token: code,
			type: 'recovery',
		});

		if (error) {
			console.error("Error verifying reset code:", error);
			return { error };
		}

		// If OTP verification succeeded, update the password
		if (data.session) {
			const { error: updateError } = await supabase.auth.updateUser({
				password: newPassword
			});

			if (updateError) {
				console.error("Error updating password:", updateError);
				return { error: updateError };
			}
		} else {
			return { error: new Error("Verification succeeded but no session was created") };
		}

		return { error: null };
	} catch (error) {
		console.error("Error resetting password:", error);
		return { error: error as Error };
	}
};

// Helper function to check if profile is complete
const checkProfileComplete = (profile: UserProfile | null): boolean => {
	if (!profile) return false;
	
	// Check required fields are filled
	return !!(
		profile.full_name &&
		profile.age &&
		profile.sex &&
		profile.preferred_hand &&
		profile.preferred_area &&
		profile.court_playing_side
	);
};

export function AuthProvider({ children }: PropsWithChildren) {
	const [initialized, setInitialized] = useState(false);
	const [session, setSession] = useState<Session | null>(null);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [isLoadingProfile, setIsLoadingProfile] = useState(false);
	const [isVerificationComplete, setIsVerificationComplete] = useState(false);
	const [isSigningIn, setIsSigningIn] = useState(false);
	const router = useRouter();
	
	// Set up redirect URI for OAuth flows
	const redirectUri = (() => {
		if (__DEV__) {
		  // IMPORTANT: This must match EXACTLY one of the URIs in Google Cloud Console
		  return "https://auth.expo.io/@qwerty-app/padel-scoring-app";
		} else {
		  // For production builds
		  return "https://tfyxkhivanmcokxugmhe.supabase.co/auth/v1/callback";
		}
	  })();
	  
	// Fetch user profile from the database
	const fetchProfile = async (userId: string) => {
		try {
			setIsLoadingProfile(true);
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', userId)
				.single();
			
			if (error) {
				console.error("Error fetching profile:", error);
				return;
			}
			
			setProfile(data);
		} catch (error) {
			console.error("Error fetching profile:", error);
		} finally {
			setIsLoadingProfile(false);
		}
	};

	const signUp = async (email: string, password: string) => {
		try {
			// Configure Supabase to use email verification
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					emailRedirectTo: null, // Disable redirect to use OTP instead
					data: {
						// Additional user data if needed
					},
				},
			});

			if (error) {
				console.error("Error signing up:", error);
				return { error };
			}

			// Check if email verification is needed
			const needsEmailVerification = !data.session;

			if (data.session) {
				setSession(data.session);
				console.log("User signed up and automatically signed in:", data.user);
				
				// Create a profile when the user signs up
				if (data.user) {
					const { error: profileError } = await supabase
						.from('profiles')
						.insert({
							id: data.user.id,
							email: data.user.email,
							created_at: new Date().toISOString(),
						});

					if (profileError) {
						console.error("Error creating profile:", profileError);
					}
				}
			} else {
				console.log("User signed up, email verification required");
			}

			return { 
				needsEmailVerification, 
				email 
			};
		} catch (error) {
			console.error("Error signing up:", error);
			return { error: error as Error };
		}
	};

	const verifyOtp = async (email: string, otp: string) => {
		try {
			// Reset verification flag at the beginning of the verification process
			setIsVerificationComplete(false);
			
			// Verify the OTP code
			const { data, error } = await supabase.auth.verifyOtp({
				email,
				token: otp,
				type: 'signup',
			});

			if (error) {
				console.error("Error verifying OTP:", error);
				return { error };
			}

			if (data.session && data.user) {
				// Check if profile exists before proceeding
				const { data: existingProfile, error: profileCheckError } = await supabase
					.from('profiles')
					.select('id')
					.eq('id', data.user.id)
					.single();

				// Handle profile check error, but ignore "no rows returned" error
				if (profileCheckError && profileCheckError.code !== 'PGRST116') {
					console.error("Error checking profile existence:", profileCheckError);
					return { error: profileCheckError };
				}

				// Create profile if it doesn't exist
				if (!existingProfile) {
					console.log("Creating new profile after verification");
					const { error: createError } = await supabase
						.from('profiles')
						.insert({
							id: data.user.id,
							email: data.user.email,
							created_at: new Date().toISOString(),
						});

					if (createError) {
						console.error("Error creating profile after verification:", createError);
						return { error: createError };
					}
				}

				// Fetch profile before setting session to ensure correct navigation
				await fetchProfile(data.user.id);
				
				// Set session only after profile operations are complete
				setSession(data.session);
				console.log("User verified and signed in:", data.user);
				
				// Mark verification as complete - will trigger navigation to onboarding
				setIsVerificationComplete(true);
			}

			return { data };
		} catch (error) {
			console.error("Error verifying OTP:", error);
			return { error: error as Error };
		}
	};

	const signIn = async (email: string, password: string) => {
		try {
			setIsSigningIn(true);
			
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				console.error("Error signing in:", error);
				throw error;
			}

			if (data.session) {
				setSession(data.session);
				console.log("User signed in:", data.user);
				
				// Fetch profile when user signs in
				if (data.user) {
					await fetchProfile(data.user.id);
				}
			}
		} catch (error) {
			console.error("Error signing in:", error);
			throw error;
		} finally {
			setIsSigningIn(false);
		}
	};

	const signOut = async () => {
		try {
			const { error } = await supabase.auth.signOut();

			if (error) {
				console.error("Error signing out:", error);
			} else {
				setSession(null);
				setProfile(null);
				console.log("User signed out");
			}
		} catch (error) {
			console.error("Error signing out:", error);
		}
	};

	const saveProfile = async (profileData: Partial<UserProfile>) => {
		try {
			if (!session?.user?.id) {
				throw new Error("No user session found");
			}

			const { data, error } = await supabase
				.from('profiles')
				.update({
					...profileData,
				})
				.eq('id', session.user.id)
				.select()
				.single();

			if (error) {
				console.error("Error saving profile:", error);
				throw error;
			}

			setProfile(data);
			console.log("Profile saved successfully");
		} catch (error) {
			console.error("Error saving profile:", error);
			throw error;
		}
	};

	// Apple Sign In implementation
	const appleSignIn = async () => {
		try {
			// Check if Apple Authentication is available on this device
			if (Platform.OS !== 'ios') {
				return { error: new Error('Apple authentication is only available on iOS devices') };
			}
			
			const isAvailable = await AppleAuthentication.isAvailableAsync();
			if (!isAvailable) {
				return { error: new Error('Apple authentication is not available on this device') };
			}

			// Request authentication with Apple
			const credential = await AppleAuthentication.signInAsync({
				requestedScopes: [
					AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
					AppleAuthentication.AppleAuthenticationScope.EMAIL,
				],
			});

			// Sign in via Supabase Auth
			if (credential.identityToken) {
				const { data, error } = await supabase.auth.signInWithIdToken({
					provider: 'apple',
					token: credential.identityToken,
				});

				if (error) {
					console.error("Apple auth error:", error);
					return { error };
				}

				if (data.session) {
					setSession(data.session);
					console.log("User signed in with Apple:", data.user);
					
					// Check if this is a new user and if they already have a profile
					if (data.user) {
						const { data: existingProfile, error: profileError } = await supabase
							.from('profiles')
							.select('*')
							.eq('id', data.user.id)
							.single();

						if (profileError && profileError.code !== 'PGRST116') {
							console.error("Error checking profile:", profileError);
						}

						if (!existingProfile) {
							// Create minimal profile if none exists
							const { error: createError } = await supabase
								.from('profiles')
								.insert({
									id: data.user.id,
									email: data.user.email,
									// Add name from Apple if available
									full_name: credential.fullName?.givenName && credential.fullName?.familyName
										? `${credential.fullName.givenName} ${credential.fullName.familyName}`
										: null,
									created_at: new Date().toISOString(),
								});

							if (createError) {
								console.error("Error creating profile:", createError);
							}
							
							// Fetch the newly created profile
							await fetchProfile(data.user.id);
							
							// Note that profile needs to be completed
							return { needsProfileUpdate: true };
						} else {
							// Fetch the existing profile
							await fetchProfile(data.user.id);
							
							// Check if the profile needs to be completed
							return { needsProfileUpdate: !checkProfileComplete(existingProfile) };
						}
					}
				}
			} else {
				return { error: new Error('No identity token received from Apple') };
			}
			
			return {};
		} catch (error: any) {
			if (error.code === 'ERR_REQUEST_CANCELED') {
				console.log('User canceled Apple sign-in');
				return {}; // Not an error, just a cancellation
			}
			
			console.error("Apple authentication error:", error);
			return { error: error as Error };
		}
	};

	const googleSignIn = async () => {
		try {
		  setIsSigningIn(true);
		  
		  console.log("Starting Google Sign-In with redirect URI:", redirectUri);
		  
		  // Step 1: Initialize OAuth flow with Supabase
		  const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
			  redirectTo: redirectUri,
			  skipBrowserRedirect: true,
			},
		  });
	  
	  
		  if (error) {
			console.error("OAuth initialization error:", error);
			throw error;
		  }
	  
		  if (data?.url) {
			console.log("Opening auth session with URL:", data.url);
			
			// Step 2: Open browser for authentication
			const result = await WebBrowser.openAuthSessionAsync(
			  data.url, 
			  redirectUri, 
			  { showInRecents: true }
			);
			
			console.log("WebBrowser result type:", result.type);
			console.log("WebBrowser result URL:", result.url);
	  
			// Rest of the function remains the same...
				if (result.type === 'success') {
					try {
						// Step 3: Extract tokens from URL if possible
						const url = new URL(result.url);
						const hashParams = new URLSearchParams(url.hash.substring(1));
						const accessToken = hashParams.get('access_token');

						if (accessToken) {
							// Step 4: Set session with extracted token
							const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
								access_token: accessToken,
								refresh_token: hashParams.get('refresh_token') || '',
							});

							if (sessionError) throw sessionError;

							if (sessionData.session) {
								// Update session state
								setSession(sessionData.session);
								
								// Check if this is a new user and if they already have a profile
								if (sessionData.session.user) {
									const { data: existingProfile, error: profileError } = await supabase
										.from('profiles')
										.select('*')
										.eq('id', sessionData.session.user.id)
										.single();

									if (profileError && profileError.code !== 'PGRST116') {
										console.error("Error checking profile:", profileError);
									}

									if (!existingProfile) {
										// Create minimal profile if none exists
										const userData = sessionData.session.user;
										const { error: createError } = await supabase
											.from('profiles')
											.insert({
												id: userData.id,
												email: userData.email,
												// Extract name from user metadata if available
												full_name: userData.user_metadata?.name || 
													userData.user_metadata?.full_name || null,
												created_at: new Date().toISOString(),
											});

										if (createError) {
											console.error("Error creating profile:", createError);
										}
										
										// Fetch the newly created profile
										await fetchProfile(userData.id);
										
										// Note that profile needs to be completed
										return { needsProfileUpdate: true };
									} else {
										// Fetch the existing profile
										await fetchProfile(sessionData.session.user.id);
										
										// Check if the profile needs to be completed
										return { needsProfileUpdate: !checkProfileComplete(existingProfile) };
									}
								}
							}
						}
					} catch (extractError) {
						console.error("Error processing auth result:", extractError);
					}
				}
			}

			// Fallback: Check if we have a session despite flow issues
			const { data: currentSession } = await supabase.auth.getSession();
			if (currentSession?.session?.user) {
				setSession(currentSession.session);
				
				// Check if the user has a profile
				const { data: existingProfile, error: profileError } = await supabase
					.from('profiles')
					.select('*')
					.eq('id', currentSession.session.user.id)
					.single();

				if (profileError && profileError.code !== 'PGRST116') {
					console.error("Error checking profile:", profileError);
				}

				if (!existingProfile) {
					// Create minimal profile if none exists
					const userData = currentSession.session.user;
					const { error: createError } = await supabase
						.from('profiles')
						.insert({
							id: userData.id,
							email: userData.email,
							// Extract name from user metadata if available
							full_name: userData.user_metadata?.name || 
								userData.user_metadata?.full_name || null,
							created_at: new Date().toISOString(),
						});

					if (createError) {
						console.error("Error creating profile:", createError);
					}
					
					// Fetch the newly created profile
					await fetchProfile(userData.id);
					
					// Note that profile needs to be completed
					return { needsProfileUpdate: true };
				} else {
					// Fetch the existing profile
					await fetchProfile(currentSession.session.user.id);
					
					// Check if the profile needs to be completed
					return { needsProfileUpdate: !checkProfileComplete(existingProfile) };
				}
			}

			return { error: new Error("Unable to sign in with Google") };
		} catch (error: any) {
			console.error('Google sign in error:', error);
			return { error };
		} finally {
			setIsSigningIn(false);
		}
	};

	useEffect(() => {
		// Check initial session
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
			if (session?.user) {
				fetchProfile(session.user.id);
			}
		});

		// Listen to auth state changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			if (session?.user) {
				fetchProfile(session.user.id);
			} else {
				setProfile(null);
			}
		});

		setInitialized(true);

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		if (initialized) {
			SplashScreen.hideAsync();
			
			if (session) {
				console.log('Session exists, checking profile...');
				console.log('Profile:', profile);
				console.log('Is profile complete:', checkProfileComplete(profile));
				
				// Don't navigate if still loading profile
				if (isLoadingProfile) {
					return;
				}
				
				// Special handling for just-completed verification - always go to onboarding
				if (isVerificationComplete) {
					console.log('Verification just completed - redirecting to onboarding');
					setIsVerificationComplete(false); // Reset the flag after navigation
					router.replace("/onboarding");
					return;
				}
				
				// Standard navigation logic for non-verification flows
				if (!checkProfileComplete(profile)) {
					router.replace("/onboarding");
				} else {
					router.replace("/(protected)/(tabs)");
				}
			} else {
				router.replace("/welcome");
			}
		}
	}, [initialized, session, profile, isLoadingProfile, isVerificationComplete]);
	
	// Show loading screen while initializing OR loading profile
	if (!initialized || isLoadingProfile) {
		return <PadelLoadingScreen />;
	}
	
	return (
		<AuthContext.Provider
			value={{
				initialized,
				session,
				profile,
				isProfileComplete: checkProfileComplete(profile),
				signUp,
				signIn,
				signOut,
				saveProfile,
				verifyOtp,
				resetPassword,
				updatePassword,
				appleSignIn,
				googleSignIn
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}