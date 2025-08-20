// Enhanced match status enumeration
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5,
  RECRUITING = 6,
}

// Complete match data interface
export interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: number;
  created_at: string;
  completed_at: string | null;
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number | null;
  is_public: boolean;
  description: string | null;
  validation_status?: string;
  all_confirmed?: boolean;
  confirmation_status?: string;
  rating_applied?: boolean;
  player1?: any;
  player2?: any;
  player3?: any;
  player4?: any;

  // Computed properties
  isTeam1?: boolean;
  userWon?: boolean;
  setScores?: string;
  isCompleted?: boolean;
  isFuture?: boolean;
  isPast?: boolean;
  needsScores?: boolean;
  needsConfirmation?: boolean;
  isDisputed?: boolean;
  teammate?: any;
  opponents?: any[];
  team1Sets?: number;
  team2Sets?: number;
}

// Enhanced user stats
export interface UserStats {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  longestStreak: number;
  averageMatchDuration: number;
  recentPerformance: "improving" | "declining" | "stable";
  ratingChange7Days: number;
  ratingChange30Days: number;
  publicMatches: number;
  privateMatches: number;
  needsConfirmation: number;
  disputed: number;
}

// Friend activity interface
export interface FriendActivity {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  avatar_url: string | null;
  recentMatch?: any;
  ratingChange?: number;
  lastActive?: string;
}

// Categorized matches interface
export interface CategorizedMatches {
  upcoming: MatchData[];
  needsAttention: MatchData[];
  recent: MatchData[];
  thisWeek: MatchData[];
  publicMatches: MatchData[];
  needsConfirmation: MatchData[];
  disputed: MatchData[];
}
