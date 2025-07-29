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
import { Platform, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import Constants from "expo-constants"

SplashScreen.preventAutoHideAsync();

// Configure WebBrowser for OAuth flows
WebBrowser.maybeCompleteAuthSession();

// FIXED: Updated UserProfile type to match actual database schema
export interface UserProfile {
	id: string;
	email: string;
	full_name: string | null;
	age: number | null;  // FIXED: Database stores as integer
	nickname: string | null;
	number: string | null;  // Contact number field
	sex: string | null;
	preferred_hand: string | null;
	preferred_area: string | null;
	glicko_rating: string | null;  // FIXED: Database stores as text
	glicko_rd: string | null;      // FIXED: Database stores as text
	glicko_vol: string | null;     // FIXED: Database stores as text
	friends_list: string[] | null; // FIXED: Database stores as array of text
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

// FIXED: Helper function to check if profile is complete with proper type handling
const checkProfileComplete = (profile: UserProfile | null): boolean => {
	if (!profile) return false;
	
	// Check required fields are filled - handle both string and number for age
	return !!(
		profile.full_name &&
		profile.age && // This is now number | null, so truthy check works
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
	
	// FIXED: Use direct local redirect URI for reliable callback handling
	const redirectUri = makeRedirectUri({
		scheme: undefined, // Let Expo auto-detect
		path: 'auth/callback'
	});

	console.log('🎯 [AUTH] USING REDIRECT URI:', redirectUri);
	  
	// Fetch user profile from the database
	const fetchProfile = async (userId: string) => {
		try {
			setIsLoadingProfile(true);
			console.log('📄 [AUTH] Fetching profile for user:', userId);
			
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', userId)
				.single();
			
			if (error) {
				console.error("❌ [AUTH] Error fetching profile:", error);
				return;
			}
			
			console.log('✅ [AUTH] Profile fetched successfully:', data);
			console.log('🔍 [AUTH] Profile completeness check:', {
				full_name: !!data.full_name,
				age: !!data.age,
				sex: !!data.sex,
				preferred_hand: !!data.preferred_hand,
				preferred_area: !!data.preferred_area,
				court_playing_side: !!data.court_playing_side
			});
			
			setProfile(data);
		} catch (error) {
			console.error("💥 [AUTH] Error fetching profile:", error);
		} finally {
			setIsLoadingProfile(false);
		}
	};

	// Process OAuth user - adapted from your implementation
	const processOAuthUser = async (session: Session): Promise<UserProfile | null> => {
		try {
			console.log('[AUTH] Processing OAuth user:', session.user.id);
			
			// Check if user exists in profiles table
			const { data: existingProfile, error: fetchError } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', session.user.id)
				.single();

			if (fetchError && fetchError.code === 'PGRST116') {
				// User doesn't exist, create new profile
				const userName = session.user.user_metadata.full_name ||
								session.user.user_metadata.name ||
								null;

				// FIXED: Use correct types for database schema
				const newProfile: Partial<UserProfile> = {
					id: session.user.id,
					email: session.user.email || '',
					full_name: userName,
					age: null,
					nickname: null,
					sex: null,
					preferred_hand: null,
					preferred_area: null,
					glicko_rating: "1500",  // FIXED: Store as string to match database
					glicko_rd: "350",       // FIXED: Store as string to match database
					glicko_vol: "0.06",     // FIXED: Store as string to match database
					friends_list: [],       // FIXED: Store as array to match database
					court_playing_side: null,
					avatar_url: session.user.user_metadata.avatar_url || null,
					created_at: new Date().toISOString(),
				};

				console.log('[AUTH] Creating new profile for OAuth user');

				// Use upsert for atomic operation
				const { data: upsertedProfile, error: upsertError } = await supabase
					.from('profiles')
					.upsert([newProfile], {
						onConflict: 'id',
						ignoreDuplicates: false
					})
					.select()
					.single();

				if (upsertError) {
					if (upsertError.code === '23505') {
						// Handle race condition - profile was created by another process
						console.log('[AUTH] Profile already exists, retrieving existing record');
						const { data: existingProfile, error: getError } = await supabase
							.from('profiles')
							.select('*')
							.eq('id', session.user.id)
							.single();

						if (getError) {
							console.error('[AUTH] Error retrieving existing profile:', getError);
							return null;
						}
						return existingProfile as UserProfile;
					} else {
						console.error('[AUTH] Error upserting profile after OAuth:', upsertError);
						return null;
					}
				}

				return upsertedProfile as UserProfile;

			} else if (fetchError) {
				console.error('[AUTH] Error fetching user profile:', fetchError);
				return null;
			}

			// Profile exists, return it
			return existingProfile as UserProfile;
		} catch (error) {
			console.error('[AUTH] Error processing OAuth user:', error);
			return null;
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
					// FIXED: Use correct types for new profile creation
					const { error: profileError } = await supabase
						.from('profiles')
						.insert({
							id: data.user.id,
							email: data.user.email,
							glicko_rating: "1500",  // FIXED: Store as string
							glicko_rd: "350",       // FIXED: Store as string
							glicko_vol: "0.06",     // FIXED: Store as string
							friends_list: [],       // FIXED: Store as array
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
					// FIXED: Use correct types for profile creation
					const { error: createError } = await supabase
						.from('profiles')
						.insert({
							id: data.user.id,
							email: data.user.email,
							glicko_rating: "1500",  // FIXED: Store as string
							glicko_rd: "350",       // FIXED: Store as string
							glicko_vol: "0.06",     // FIXED: Store as string
							friends_list: [],       // FIXED: Store as array
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
							// FIXED: Create minimal profile with correct types
							const { error: createError } = await supabase
								.from('profiles')
								.insert({
									id: data.user.id,
									email: data.user.email,
									// Add name from Apple if available
									full_name: credential.fullName?.givenName && credential.fullName?.familyName
										? `${credential.fullName.givenName} ${credential.fullName.familyName}`
										: null,
									glicko_rating: "1500",  // FIXED: Store as string
									glicko_rd: "350",       // FIXED: Store as string
									glicko_vol: "0.06",     // FIXED: Store as string
									friends_list: [],       // FIXED: Store as array
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

	// FIXED: Direct Google Sign In with proper callback handling
	const googleSignIn = async () => {
		try {
			console.log('🚀 [AUTH] Starting Google sign in with direct redirect');
			console.log('🎯 [AUTH] Using redirect URI:', redirectUri);

			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: redirectUri,
					skipBrowserRedirect: true,
					queryParams: {
						access_type: 'offline',
						prompt: 'consent',
					}
				},
			});

			if (error) {
				console.error('❌ [AUTH] Error initiating Google OAuth:', error);
				return { error };
			}

			console.log('✅ [AUTH] OAuth initiation successful');

			if (data?.url) {
				console.log('🌐 [AUTH] Opening Google auth session with proper callback handling');

				// CRITICAL: Use proper WebBrowser session with explicit return URL handling
				const result = await WebBrowser.openAuthSessionAsync(
					data.url, 
					redirectUri,
					{
						showInRecents: false,
						preferEphemeralSession: true,
					}
				);

				console.log('📱 [AUTH] WebBrowser result type:', result.type);

				if (result.type === 'success') {
					console.log('✅ [AUTH] OAuth callback successful');
					console.log('🔍 [AUTH] Processing callback URL...');

					try {
						// ENHANCED: Multiple token extraction methods
						const url = new URL(result.url);
						
						// Method 1: Fragment (hash) parameters - most common for OAuth
						let accessToken = null;
						let refreshToken = null;
						
						if (url.hash) {
							const hashParams = new URLSearchParams(url.hash.substring(1));
							accessToken = hashParams.get('access_token');
							refreshToken = hashParams.get('refresh_token');
							console.log('🔑 [AUTH] Hash extraction - tokens found:', !!accessToken);
						}
						
						// Method 2: Search parameters - fallback
						if (!accessToken && url.search) {
							const searchParams = new URLSearchParams(url.search);
							accessToken = searchParams.get('access_token');
							refreshToken = searchParams.get('refresh_token');
							console.log('🔑 [AUTH] Search extraction - tokens found:', !!accessToken);
						}

						if (accessToken) {
							console.log('✅ [AUTH] Tokens extracted successfully');
							console.log('📏 [AUTH] Access token length:', accessToken.length);

							// Set session with extracted tokens
							const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
								access_token: accessToken,
								refresh_token: refreshToken || '',
							});

							if (sessionError) {
								console.error('❌ [AUTH] Session creation failed:', sessionError);
								return { error: sessionError };
							}

							if (sessionData.session) {
								console.log('🎉 [AUTH] Session established successfully');
								console.log('👤 [AUTH] User:', sessionData.session.user.email);

								setSession(sessionData.session);

								// Process user profile
								const userProfile = await processOAuthUser(sessionData.session);
								if (userProfile) {
									setProfile(userProfile);
									console.log('✅ [AUTH] Google sign in completed successfully');
									return { 
										needsProfileUpdate: !checkProfileComplete(userProfile)
									};
								} else {
									console.error('❌ [AUTH] Profile processing failed');
									return { error: new Error('Failed to process user profile') };
								}
							} else {
								console.error('❌ [AUTH] No session created despite successful token extraction');
								return { error: new Error('Session creation failed') };
							}
						} else {
							console.error('❌ [AUTH] No access token found in callback URL');
							console.log('🔍 [AUTH] Full callback URL:', result.url);
							return { error: new Error('No access token received') };
						}
					} catch (urlError) {
						console.error('❌ [AUTH] URL processing error:', urlError);
						return { error: urlError as Error };
					}
				} else if (result.type === 'cancel') {
					console.log('👤 [AUTH] User canceled Google sign-in');
					return {}; // Not an error
				} else {
					console.error('❌ [AUTH] Unexpected WebBrowser result:', result.type);
					return { error: new Error(`Authentication failed: ${result.type}`) };
				}
			}

			console.error('❌ [AUTH] No OAuth URL generated');
			return { error: new Error('OAuth initialization failed') };
		} catch (error) {
			console.error('💥 [AUTH] Critical Google sign in error:', error);
			return { error: error as Error };
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
				console.log('🔐 [AUTH] Session exists, checking profile...');
				console.log('👤 [AUTH] Profile:', profile);
				console.log('✅ [AUTH] Is profile complete:', checkProfileComplete(profile));
				
				// Don't navigate if still loading profile
				if (isLoadingProfile) {
					console.log('⏳ [AUTH] Still loading profile, waiting...');
					return;
				}
				
				// Special handling for just-completed verification - always go to onboarding
				if (isVerificationComplete) {
					console.log('📧 [AUTH] Verification just completed - redirecting to onboarding');
					setIsVerificationComplete(false); // Reset the flag after navigation
					router.replace("/onboarding");
					return;
				}
				
				// Standard navigation logic for non-verification flows
				if (!checkProfileComplete(profile)) {
					console.log('📝 [AUTH] Profile incomplete - redirecting to onboarding');
					router.replace("/onboarding");
				} else {
					console.log('🏠 [AUTH] Profile complete - redirecting to main app');
					router.replace("/(protected)/(tabs)");
				}
			} else {
				console.log('👋 [AUTH] No session - redirecting to welcome');
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
				googleSignIn,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}