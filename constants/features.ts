export const FEATURE_FLAGS = {
  // Toggle visibility/availability of public matches functionality
  PUBLIC_MATCHES_ENABLED: false,

  // Toggle ability for users to schedule matches in the future (more than ~15 minutes ahead)
  FUTURE_MATCH_SCHEDULING_ENABLED: false,
} as const; 