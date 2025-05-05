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
  
  SplashScreen.preventAutoHideAsync();
  
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
	signUp: (email: string, password: string) => Promise<void>;
	signIn: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
	saveProfile: (profileData: Partial<UserProfile>) => Promise<void>;
  };
  
  export const AuthContext = createContext<AuthState>({
	initialized: false,
	session: null,
	profile: null,
	isProfileComplete: false,
	signUp: async () => {},
	signIn: async () => {},
	signOut: async () => {},
	saveProfile: async () => {},
  });
  
  export const useAuth = () => useContext(AuthContext);
  
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
	const router = useRouter();
  
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
		const { data, error } = await supabase.auth.signUp({
		  email,
		  password,
		});
  
		if (error) {
		  console.error("Error signing up:", error);
		  return;
		}
  
		if (data.session) {
		  setSession(data.session);
		  console.log("User signed up:", data.user);
		  
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
		}
	  } catch (error) {
		console.error("Error signing up:", error);
	  }
	};
  
	const signIn = async (email: string, password: string) => {
	  try {
		const { data, error } = await supabase.auth.signInWithPassword({
		  email,
		  password,
		});
  
		if (error) {
		  console.error("Error signing in:", error);
		  return;
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
			
			if (!checkProfileComplete(profile)) {
			  router.replace("/onboarding");
			} else {
			  router.replace("/(protected)/(tabs)");
			}
		  } else {
			router.replace("/welcome");
		  }
		}
	  }, [initialized, session, profile, isLoadingProfile]);
	  
	  const isProfileComplete = checkProfileComplete(profile);
	  
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
			isProfileComplete,
			signUp,
			signIn,
			signOut,
			saveProfile,
		  }}
		>
		  {children}
		</AuthContext.Provider>
	  );
	}