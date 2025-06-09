/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/supabase-provider";
import { useBackgroundValidationProcessor } from '@/hooks/useBackgroundValidationProcessor';
import { useEffect, useState } from 'react'; // Only add if not already imported

export const unstable_settings = {
	initialRouteName: "(tabs)",
};

export default function ProtectedLayout() {
	const { initialized, session, isProfileComplete } = useAuth(); const {
		isProcessing: isValidationProcessing,
		isActive: isValidationActive,
		stats: validationStats,
		isHealthy: isValidationHealthy,
		startProcessing: startValidationProcessing,
		stopProcessing: stopValidationProcessing,
		forceProcessNow: forceValidationProcessing
	  } = useBackgroundValidationProcessor({
		// CONFIGURATION: Adjust these values based on app requirements
		processingIntervalMs: 5 * 60 * 1000,  // 5 minutes for production
		batchSizeLimit: 25,                    // Conservative batch size
		maxConsecutiveFailures: 3              // Reduced failure tolerance
	  });
	
	  // STEP 6.1.1.2.2: Validation Health Monitoring State
	  const [showValidationAlert, setShowValidationAlert] = useState<boolean>(false);
	  const [lastValidationCheck, setLastValidationCheck] = useState<Date>(new Date());	
	  // STEP 6.1.1.2.3: Validation Health Monitoring Effect
	  useEffect(() => {
		// Monitor validation processor health and alert on issues
		const healthCheckInterval = setInterval(() => {
		  setLastValidationCheck(new Date());
		  
		  // CRITICAL CONDITION: Alert if validation processing is unhealthy
		  if (!isValidationHealthy && isValidationActive) {
			console.warn('⚠️ [APP_LAYOUT] Validation processing health degraded:', {
			  consecutiveFailures: validationStats.consecutiveFailures,
			  lastSuccessAt: validationStats.lastSuccessAt,
			  isActive: isValidationActive
			});
			
			setShowValidationAlert(true);
			
			// RECOVERY ATTEMPT: Automatic restart after health issues
			setTimeout(() => {
			  console.log('🔄 [APP_LAYOUT] Attempting validation processor recovery');
			  stopValidationProcessing();
			  setTimeout(startValidationProcessing, 2000); // 2-second delay before restart
			}, 5000); // 5-second delay before recovery attempt
		  } else if (showValidationAlert && isValidationHealthy) {
			// Health restored, clear alert
			setShowValidationAlert(false);
		  }
		}, 60000); // Health check every 60 seconds
	
		return () => clearInterval(healthCheckInterval);
	  }, [isValidationHealthy, isValidationActive, validationStats.consecutiveFailures, 
		  validationStats.lastSuccessAt, showValidationAlert, 
		  stopValidationProcessing, startValidationProcessing]);
	

		  if (!initialized) {
			return null;
		  }
		
		  if (!session) {
			return <Redirect href="/welcome" />;
		  }
		
		  // Add this check to prevent redirection to tabs if profile is incomplete
		  if (!isProfileComplete) {
			return <Redirect href="/onboarding" />;
		  }
	  
	  return (
		<Stack
		  screenOptions={{
			headerShown: false,
		  }}
		>
		  <Stack.Screen name="(tabs)" />
		  <Stack.Screen name="modal" options={{ presentation: "modal" }} />
		  <Stack.Screen name="(screens)/friends" />
		  <Stack.Screen name="(screens)/friend-profile" />
		  <Stack.Screen name="(screens)/create-match" />
		  <Stack.Screen name="(screens)/match-history" />
		  <Stack.Screen name="(screens)/match-details" />
		  <Stack.Screen name="(screens)/leaderboard" />
		  <Stack.Screen name="(screens)/edit-match" />
		</Stack>
	  );
	}
  
	
  
	