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
	
	// CRITICAL: Generate and debug redirect URI
	const generateRedirectUri = () => {
		// Method 1: Using makeRedirectUri with explicit configuration
		const method1 = makeRedirectUri({
			scheme: undefined, // Let Expo determine the scheme
			path: 'auth/callback'
		});

		// Method 2: Using your app's specific scheme
		const method2 = makeRedirectUri({
			scheme: 'com.qwertyapp.padel-scoring-app',
			path: 'auth/callback'
		});

		// Method 3: Expo's standard OAuth callback
		const method3 = 'https://auth.expo.io/@qwerty-app/padel-scoring-app';

		// Method 4: Supabase callback for production
		const method4 = 'https://tfyxkhivanmcokxugmhe.supabase.co/auth/v1/callback';

		console.log('🔍 REDIRECT URI DEBUG INFORMATION:');
		console.log('Method 1 (Auto-scheme):', method1);
		console.log('Method 2 (Custom scheme):', method2);
		console.log('Method 3 (Expo standard):', method3);
		console.log('Method 4 (Supabase):', method4);

		// Return the most reliable method for Expo development
		const selectedUri = __DEV__ ? method3 : method4;
		console.log('🎯 SELECTED REDIRECT URI:', selectedUri);
		
		return selectedUri;
	};

	const redirectUri = generateRedirectUri();
	  
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

				const newProfile: Partial<UserProfile> = {
					id: session.user.id,
					email: session.user.email || '',
					full_name: userName,
					age: null,
					nickname: null,
					sex: null,
					preferred_hand: null,
					preferred_area: null,
					glicko_rating: 1500, // Default Glicko rating
					glicko_rd: 350,     // Default rating deviation
					glicko_vol: 0.06,   // Default volatility
					friends_list: [],
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

	// ENHANCED Google Sign In implementation with comprehensive debugging
	const googleSignIn = async () => {
		try {
			console.log('🚀 [AUTH] Starting Google sign in');
			console.log('🎯 [AUTH] Using redirect URI:', redirectUri);

			// CRITICAL: Show redirect URI to user for verification
			Alert.alert(
				'Debug: Redirect URI',
				`Using: ${redirectUri}`,
				[{ text: 'Continue', onPress: () => {} }]
			);

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
			console.log('🔗 [AUTH] OAuth URL generated:', data?.url?.substring(0, 100) + '...');

			if (data?.url) {
				console.log('🌐 [AUTH] Opening Google auth session');

				const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
				console.log('📱 [AUTH] WebBrowser result type:', result.type);
				console.log('🔍 [AUTH] WebBrowser result URL:', result.type === 'success' ? result.url?.substring(0, 100) + '...' : 'N/A');

				if (result.type === 'success') {
					try {
						// Extract tokens from URL
						const url = new URL(result.url);
						console.log('🔍 [AUTH] Parsing callback URL');
						console.log('🔍 [AUTH] URL pathname:', url.pathname);
						console.log('🔍 [AUTH] URL search:', url.search);
						console.log('🔍 [AUTH] URL hash:', url.hash);

						// Try both hash and search params
						let accessToken = null;
						let refreshToken = null;

						// Method 1: Hash parameters (most common)
						if (url.hash) {
							const hashParams = new URLSearchParams(url.hash.substring(1));
							accessToken = hashParams.get('access_token');
							refreshToken = hashParams.get('refresh_token');
							console.log('🔑 [AUTH] Hash method - Access token found:', !!accessToken);
						}

						// Method 2: Search parameters (fallback)
						if (!accessToken && url.search) {
							const searchParams = new URLSearchParams(url.search);
							accessToken = searchParams.get('access_token');
							refreshToken = searchParams.get('refresh_token');
							console.log('🔑 [AUTH] Search method - Access token found:', !!accessToken);
						}

						console.log('🔑 [AUTH] Final token extraction result:', { 
							hasAccessToken: !!accessToken, 
							hasRefreshToken: !!refreshToken,
							tokenLength: accessToken?.length || 0
						});

						if (accessToken) {
							console.log('✅ [AUTH] Setting session with extracted tokens');

							// Set session manually
							const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
								access_token: accessToken,
								refresh_token: refreshToken || '',
							});

							if (sessionError) {
								console.error('❌ [AUTH] Error setting session:', sessionError);
								return { error: sessionError };
							}

							if (sessionData.session) {
								console.log('✅ [AUTH] Session set successfully');
								console.log('👤 [AUTH] User ID:', sessionData.session.user.id);
								console.log('📧 [AUTH] User email:', sessionData.session.user.email);

								setSession(sessionData.session);

								const userProfile = await processOAuthUser(sessionData.session);
								if (userProfile) {
									setProfile(userProfile);
									
									console.log('🎉 [AUTH] Google sign in successful');
									return { 
										needsProfileUpdate: !checkProfileComplete(userProfile)
									};
								} else {
									console.error('❌ [AUTH] Failed to process OAuth user profile');
									return { error: new Error('Failed to create user profile') };
								}
							}
						} else {
							console.error('❌ [AUTH] No access token extracted from callback URL');
							console.log('🔍 [AUTH] Full callback URL for debugging:', result.url);
							return { error: new Error('No access token received from Google') };
						}
					} catch (extractError) {
						console.error('❌ [AUTH] Error processing Google auth result:', extractError);
						return { error: extractError as Error };
					}
				} else if (result.type === 'cancel') {
					console.log('👤 [AUTH] User canceled Google sign-in');
					return {}; // Not an error, just cancellation
				} else {
					console.error('❌ [AUTH] Unexpected WebBrowser result type:', result.type);
					return { error: new Error(`Unexpected browser result: ${result.type}`) };
				}
			}

			// Fallback session check
			try {
				console.log('🔄 [AUTH] Attempting fallback session check');
				const { data: currentSession } = await supabase.auth.getSession();
				if (currentSession?.session?.user) {
					console.log('✅ [AUTH] Google sign in fallback path successful');
					setSession(currentSession.session);
					
					const userProfile = await processOAuthUser(currentSession.session);
					if (userProfile) {
						setProfile(userProfile);
						return { 
							needsProfileUpdate: !checkProfileComplete(userProfile)
						};
					}
				}
			} catch (sessionCheckError) {
				console.error('❌ [AUTH] Error checking session after Google auth:', sessionCheckError);
			}

			console.log('❌ [AUTH] Google authentication failed - no session established');
			return { error: new Error('Google authentication failed') };
		} catch (error) {
			console.error('💥 [AUTH] Google sign in critical error:', error);
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
				googleSignIn,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}