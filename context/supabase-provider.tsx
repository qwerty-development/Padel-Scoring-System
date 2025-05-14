/* eslint-disable prettier/prettier */
import {
    createContext,
    PropsWithChildren,
    useContext,
    useEffect,
    useState,
} from "react";
import { SplashScreen, useRouter } from "expo-router";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase"; // Assuming this path is correct
import PadelLoadingScreen from "@/components/PadelLoadingScreen"; // Assuming this path is correct
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session"; // Changed from expo-auth-session for clarity
import Constants from "expo-constants";
import 'react-native-url-polyfill/auto'; // Recommended for URL parsing

SplashScreen.preventAutoHideAsync();

// Define the UserProfile type (as provided)
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
    isLoadingProfile: boolean; // Added for clarity
    isSigningInWithGoogle: boolean; // Added for Google Sign-In loading state
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
    appleSignIn: () => Promise<{
        error?: Error;
        needsProfileUpdate?: boolean;
    }>;
    googleSignIn: () => Promise<{ // Added Google Sign-In method
        error?: Error;
        needsProfileUpdate?: boolean;
        cancelled?: boolean;
    }>;
};

export const AuthContext = createContext<AuthState>({
    initialized: false,
    session: null,
    profile: null,
    isProfileComplete: false,
    isLoadingProfile: true,
    isSigningInWithGoogle: false,
    signUp: async () => ({}),
    signIn: async () => {},
    signOut: async () => {},
    saveProfile: async () => {},
    verifyOtp: async () => ({}),
    resetPassword: async () => ({}),
    updatePassword: async () => ({}),
    appleSignIn: async () => ({}),
    googleSignIn: async () => ({}), // Added Google Sign-In method
});

export const useAuth = () => useContext(AuthContext);

// Helper function to check if profile is complete (as provided)
const checkProfileComplete = (profile: UserProfile | null): boolean => {
    if (!profile) return false;
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
    const [isLoadingProfile, setIsLoadingProfile] = useState(true); // Initialize to true
    const [isVerificationComplete, setIsVerificationComplete] = useState(false);
    const [isSigningIn, setIsSigningIn] = useState(false); // For email/password sign-in
    const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false); // For Google Sign-In
    const router = useRouter();

    // --- IMPORTANT: Configure your app's scheme ---
    // 1. Define a unique scheme in your app.json, e.g., "padelapp" or "com.yourcompany.padelapp"
    //    "expo": {
    //      "scheme": "padelapp",
    //      // ... other configs
    //    }
    // 2. This scheme MUST be consistent here and in your Supabase/Google Cloud setup.
    const appScheme = Constants.expoConfig?.scheme || "com.qwertyapp.padel-scoring-app"; // Fallback, ensure your app.json has a scheme
    const googleOAuthRedirectUri = makeRedirectUri({
        scheme: appScheme,
        path: "auth/google/callback", // Or any path, ensure it's unique and configured
    });
    console.log("Google OAuth Redirect URI for this app:", googleOAuthRedirectUri);
    // This `googleOAuthRedirectUri` (e.g., com.padelapp.auth://auth/google/callback) MUST be added to:
    // 1. Supabase Dashboard -> Authentication -> Providers -> Google -> "Additional Redirect URLs"
    // 2. Google Cloud Console -> APIs & Services -> Credentials -> Your OAuth 2.0 Client ID for Web application -> "Authorized redirect URIs"

    // Your Supabase instance redirect URL (https://<project-ref>.supabase.co/auth/v1/callback)
    // should also be in Google Cloud Console -> "Authorized redirect URIs".

    const fetchProfile = async (userId: string, currentSession?: Session | null) => {
        if (!userId) {
            setProfile(null);
            setIsLoadingProfile(false);
            return;
        }
        try {
            setIsLoadingProfile(true);
            const { data, error, status } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && status !== 406) { // 406 means no rows found, which is fine if profile not created yet
                console.error("Error fetching profile:", error);
                setProfile(null); // Clear profile on error
            } else if (data) {
                setProfile(data as UserProfile);
            } else {
                // Profile doesn't exist yet, might be created by OAuth flow later
                setProfile(null);
                // If it's an OAuth flow and profile is missing, processAndFetchOAuthProfile should handle it
                if (currentSession && (currentSession.user.app_metadata.provider === 'google' || currentSession.user.app_metadata.provider === 'apple')) {
                    console.log("Profile not found for OAuth user, attempting to process/create.");
                    // This will be handled by processAndFetchOAuthProfile directly in the sign-in flows
                }
            }
        } catch (error) {
            console.error("Catch Error fetching profile:", error);
            setProfile(null);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    // Process OAuth User (Google/Apple) - Create profile if not exists, then fetch
    const processAndFetchOAuthProfile = async (oauthSession: Session): Promise<{ error?: Error; needsProfileUpdate?: boolean }> => {
        if (!oauthSession?.user) {
            return { error: new Error("No user in OAuth session") };
        }
        const user = oauthSession.user;
        try {
            setIsLoadingProfile(true);
            // Check if profile exists
            const { data: existingProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url') // Select only necessary fields for check
                .eq('id', user.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: No rows found
                console.error("Error checking for existing profile:", fetchError);
                setIsLoadingProfile(false);
                return { error: fetchError };
            }

            let finalProfile: UserProfile | null = existingProfile as UserProfile | null;

            if (!existingProfile) {
                console.log("Profile not found for OAuth user, creating new one...");
                const newProfileData: Partial<UserProfile> = {
                    id: user.id,
                    email: user.email || '',
                    full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || "New User",
                    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
                    created_at: new Date().toISOString(),
                    // Initialize other fields to null or default if necessary
                    age: null,
                    nickname: null,
                    sex: null,
                    preferred_hand: null,
                    preferred_area: null,
                    glicko_rating: null,
                    glicko_rd: null,
                    glicko_vol: null,
                    friends_list: null,
                    court_playing_side: null,
                };

                const { data: createdProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert(newProfileData)
                    .select('*')
                    .single();

                if (createError) {
                    console.error("Error creating profile for OAuth user:", createError);
                    setIsLoadingProfile(false);
                    return { error: createError };
                }
                finalProfile = createdProfile as UserProfile;
                console.log("New profile created for OAuth user:", finalProfile);
            } else {
                 // Optionally update existing profile fields like avatar_url if they changed
                const updates: Partial<UserProfile> = {};
                const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
                if (googleAvatar && existingProfile.avatar_url !== googleAvatar) {
                    updates.avatar_url = googleAvatar;
                }
                if (user.email && existingProfile.email !== user.email) {
                    updates.email = user.email; // Sync email if changed
                }
                // Add other potential updates here

                if (Object.keys(updates).length > 0) {
                    const { data: updatedProfile, error: updateError } = await supabase
                        .from('profiles')
                        .update(updates)
                        .eq('id', user.id)
                        .select('*')
                        .single();
                    if (updateError) {
                        console.warn("Could not update profile for OAuth user:", updateError);
                    } else if (updatedProfile){
                        finalProfile = updatedProfile as UserProfile;
                        console.log("Profile updated for OAuth user:", finalProfile);
                    }
                }
            }

            setProfile(finalProfile); // Set the profile state
            setIsLoadingProfile(false);
            return { needsProfileUpdate: !checkProfileComplete(finalProfile) };

        } catch (error) {
            console.error("Error in processAndFetchOAuthProfile:", error);
            setIsLoadingProfile(false);
            setProfile(null); // Clear profile on error
            return { error: error as Error, needsProfileUpdate: true }; // Assume update needed on error
        }
    };


    const signUp = async (email: string, password: string) => {
        // ... (your existing signUp function - no changes needed here for Google Sign-In)
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: null,
                    data: {},
                },
            });
            if (error) {
                console.error("Error signing up:", error);
                return { error };
            }
            const needsEmailVerification = !data.session;
            if (data.session && data.user) {
                setSession(data.session);
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        email: data.user.email,
                        created_at: new Date().toISOString(),
                    });
                if (profileError) console.error("Error creating profile on signup:", profileError);
                await fetchProfile(data.user.id, data.session); // Fetch after creation
            }
            return { needsEmailVerification, email };
        } catch (error) {
            return { error: error as Error };
        }
    };

    const verifyOtp = async (email: string, otp: string) => {
        // ... (your existing verifyOtp function - ensure fetchProfile is called correctly)
        setIsVerificationComplete(false);
        try {
            const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
            if (error) return { error };
            if (data.session && data.user) {
                const { data: existingProfile, error: profileCheckError } = await supabase
                    .from('profiles').select('id').eq('id', data.user.id).single();
                if (profileCheckError && profileCheckError.code !== 'PGRST116') return { error: profileCheckError };
                if (!existingProfile) {
                    const { error: createError } = await supabase.from('profiles').insert({
                        id: data.user.id, email: data.user.email, created_at: new Date().toISOString(),
                    });
                    if (createError) return { error: createError };
                }
                setSession(data.session); // Set session first
                await fetchProfile(data.user.id, data.session); // Then fetch profile
                setIsVerificationComplete(true); // This will trigger navigation
            }
            return { data };
        } catch (error) {
            return { error: error as Error };
        }
    };

    const signIn = async (email: string, password: string) => {
        // ... (your existing signIn function - ensure fetchProfile is called correctly)
        setIsSigningIn(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.session && data.user) {
                setSession(data.session);
                await fetchProfile(data.user.id, data.session);
            }
        } catch (error) {
            console.error("Error signing in:", error); throw error;
        } finally {
            setIsSigningIn(false);
        }
    };

    const signOut = async () => {
        // ... (your existing signOut function)
        try {
            const { error } = await supabase.auth.signOut();
            if (error) console.error("Error signing out:", error);
            else {
                setSession(null); setProfile(null);
                console.log("User signed out");
            }
        } catch (error) { console.error("Error signing out:", error); }
    };

    const saveProfile = async (profileData: Partial<UserProfile>) => {
        // ... (your existing saveProfile function - ensure fetchProfile or setProfile is called correctly)
        try {
            if (!session?.user?.id) throw new Error("No user session found");
            const { data, error } = await supabase.from('profiles').update({ ...profileData })
                .eq('id', session.user.id).select().single();
            if (error) throw error;
            setProfile(data as UserProfile); // Update local profile state
            console.log("Profile saved successfully");
        } catch (error) { console.error("Error saving profile:", error); throw error; }
    };
    
    const resetPasswordFn = async (email: string) => { // Renamed to avoid conflict
        // ... (your existing resetPassword function)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: null });
            if (error) return { error };
            return { error: null };
        } catch (error) { return { error: error as Error }; }
    };

    const updatePasswordFn = async (email: string, code: string, newPassword: string) => { // Renamed
        // ... (your existing updatePassword function)
        try {
            const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
            if (error) return { error };
            if (data.session) {
                const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
                if (updateError) return { error: updateError };
            } else { return { error: new Error("Verification succeeded but no session") }; }
            return { error: null };
        } catch (error) { return { error: error as Error }; }
    };

    const appleSignIn = async () => {
        // ... (your existing appleSignIn function, ensure it calls processAndFetchOAuthProfile)
        try {
            if (Platform.OS !== 'ios' || !await AppleAuthentication.isAvailableAsync()) {
                return { error: new Error('Apple Auth not available') };
            }
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
            });
            if (credential.identityToken) {
                const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
                    provider: 'apple', token: credential.identityToken,
                });
                if (authError) return { error: authError };
                if (authData.session) {
                    setSession(authData.session); // Set session immediately
                    // Process profile (create if new, fetch if existing)
                    const profileResult = await processAndFetchOAuthProfile(authData.session);
                    return { error: profileResult.error, needsProfileUpdate: profileResult.needsProfileUpdate };
                }
            }
            return { error: new Error('No identity token from Apple') };
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') return {};
            return { error: error as Error };
        }
    };

    // --- Google Sign In ---
    const googleSignIn = async (): Promise<{ error?: Error; needsProfileUpdate?: boolean, cancelled?: boolean }> => {
        setIsSigningInWithGoogle(true);
        try {
            // 1. Get OAuth URL from Supabase
            const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: googleOAuthRedirectUri, // Your app's deep link
                    skipBrowserRedirect: true,        // We handle the browser opening
                    // queryParams: { access_type: 'offline', prompt: 'consent' } // Optional: for refresh token
                },
            });

            if (oauthError) {
                console.error("Supabase signInWithOAuth (Google) error:", oauthError);
                return { error: oauthError };
            }
            if (!oauthData?.url) {
                return { error: new Error("No URL from Supabase for Google OAuth") };
            }

            // 2. Open WebBrowser
            const result = await WebBrowser.openAuthSessionAsync(oauthData.url, googleOAuthRedirectUri, {
                // Ensure it opens in app context if possible, or preferred browser
                // presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN, // iOS specific
            });
            
            if (result.type === 'success' && result.url) {
                const url = new URL(result.url);
                const hashParams = new URLSearchParams(url.hash.substring(1)); // Remove '#'
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token'); // May not always be present
                const errorDescription = hashParams.get('error_description');

                if (errorDescription) {
                    console.error("Google OAuth error from redirect:", errorDescription);
                    return { error: new Error(errorDescription) };
                }

                if (accessToken) {
                     // Supabase JS client v2.41.0+ handles PKCE and setSession automatically
                     // if detectSessionInUrl is true (default) and the redirect URL matches.
                     // However, with skipBrowserRedirect: true and manual openAuthSessionAsync,
                     // we often need to manually set the session, especially if tokens are in hash.
                     // Let's try setSession explicitly.
                    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || '', // Provide empty string if null
                    });

                    if (sessionError) {
                        console.error("Error setting session with Google tokens:", sessionError);
                        return { error: sessionError };
                    }

                    if (sessionData.session) {
                        setSession(sessionData.session); // Update local session state
                        // Process profile (create if new, fetch if existing)
                        const profileResult = await processAndFetchOAuthProfile(sessionData.session);
                        return { error: profileResult.error, needsProfileUpdate: profileResult.needsProfileUpdate };
                    } else {
                        return { error: new Error("Failed to establish session with Google tokens") };
                    }
                } else {
                    return { error: new Error("No access_token in Google OAuth response URL") };
                }
            } else if (result.type === 'cancel' || result.type === 'dismiss') {
                console.log("Google Sign-In cancelled by user.");
                return { cancelled: true };
            } else {
                console.warn("Google Sign-In WebBrowser result not 'success':", result);
                return { error: new Error("Google Sign-In failed or was cancelled.") };
            }
        } catch (error: any) {
            console.error("Google Sign-In main error catch:", error);
            return { error };
        } finally {
            setIsSigningInWithGoogle(false);
        }
    };


    useEffect(() => {
        // Initial session fetch
        supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
            setSession(initialSession);
            if (initialSession?.user) {
                await fetchProfile(initialSession.user.id, initialSession);
            } else {
                setIsLoadingProfile(false); // No user, so profile loading is done (no profile)
            }
            setInitialized(true);
        });

        // Auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, newSession) => {
                setSession(newSession); // Update session immediately
                if (newSession?.user) {
                    console.log(`Auth event: ${_event}. User: ${newSession.user.id}`);
                    // For SIGNED_IN via OAuth, processAndFetchOAuthProfile is called in the signIn method.
                    // For other events like TOKEN_REFRESHED or USER_UPDATED, or if profile is missing, fetch it.
                    if (_event === 'SIGNED_IN' && (newSession.user.app_metadata.provider === 'google' || newSession.user.app_metadata.provider === 'apple')) {
                        // Profile processing is handled by the respective signIn functions
                        // but ensure isLoadingProfile is false if profile is set by them.
                        if (profile && profile.id === newSession.user.id) {
                             setIsLoadingProfile(false);
                        } else {
                            // This case might happen if onAuthStateChange fires before processAndFetchOAuthProfile completes
                            // or if there's a direct session recovery.
                            await processAndFetchOAuthProfile(newSession);
                        }
                    } else {
                         await fetchProfile(newSession.user.id, newSession);
                    }
                } else {
                    setProfile(null);
                    setIsLoadingProfile(false); // No user, no profile to load
                }
                // If initialized is false, the initial getSession() will set it.
                // If already initialized, this is an update.
                if (!initialized) {
                    setInitialized(true);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [initialized]); // Added initialized to dependencies

    useEffect(() => {
        if (!initialized || isLoadingProfile) { // Wait for init and profile loading
            return;
        }

        SplashScreen.hideAsync();

        if (session && profile !== undefined) { // Ensure profile state has been assessed
            console.log('Navigation check: Session exists. Profile loaded. Profile:', profile);
            console.log('Is profile complete:', checkProfileComplete(profile));

            if (isVerificationComplete) {
                console.log('Verification just completed - redirecting to onboarding');
                setIsVerificationComplete(false);
                router.replace("/onboarding");
                return;
            }

            if (!checkProfileComplete(profile)) {
                router.replace("/onboarding");
            } else {
                router.replace("/(protected)/(tabs)");
            }
        } else if (session && profile === undefined && !isLoadingProfile) {
            // This case might indicate an issue, e.g. profile fetch failed silently or user deleted during session
            console.warn("Session exists but profile is undefined and not loading. Navigating to welcome as fallback.");
            router.replace("/welcome");
        }
        else if (!session) {
            router.replace("/welcome");
        }
    }, [initialized, session, profile, isLoadingProfile, isVerificationComplete, router]);


    if (!initialized || (session && isLoadingProfile && profile === null)) {
        // Show loading if not initialized OR if there's a session but profile is still being fetched for the first time
        return <PadelLoadingScreen />;
    }

    return (
        <AuthContext.Provider
            value={{
                initialized,
                session,
                profile,
                isProfileComplete: checkProfileComplete(profile),
                isLoadingProfile,
                isSigningInWithGoogle,
                signUp,
                signIn,
                signOut,
                saveProfile,
                verifyOtp,
                resetPassword: resetPasswordFn, // Use renamed function
                updatePassword: updatePasswordFn, // Use renamed function
                appleSignIn,
                googleSignIn, // Provide Google Sign-In method
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
