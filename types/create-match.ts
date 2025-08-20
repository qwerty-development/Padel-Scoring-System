// ENHANCEMENT: Add validation status enum
export enum ValidationStatus {
  PENDING = "pending",
  VALIDATED = "validated",
  DISPUTED = "disputed",
  EXPIRED = "expired",
}

// ENHANCEMENT: Enhanced Match Status Enum with validation support
export enum MatchStatus {
  PENDING = 1, // Future match, waiting for start time
  NEEDS_CONFIRMATION = 2, // Match finished, waiting for score confirmation
  CANCELLED = 3, // Match was cancelled
  COMPLETED = 4, // Match completed with scores recorded
  RECRUITING = 5, // Public match looking for players
}

// WIZARD STEP CONFIGURATION
export enum WizardStep {
  LOCATION_SETTINGS = 1,
  MATCH_TYPE_TIME = 2,
  PLAYER_SELECTION = 3,
  SCORE_ENTRY = 4,
  REVIEW_SUBMIT = 5,
}

export interface Court {
  id: string;
  name: string;
  region: string;
  area: string;
  type: "indoor" | "outdoor";
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  glicko_rating: string | null;
  glicko_rd: string | null;
  glicko_vol: string | null;
  avatar_url?: string | null;
  friends_list?: string[];
}

export interface MatchData {
  id?: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: number;
  created_at?: string;
  completed_at: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number | null;
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  is_public: boolean;
  description?: string;
  updated_by?: string;
  validation_deadline?: string;
  validation_status?: string;
  rating_applied?: boolean;
  report_count?: number;
  creator_confirmed?: boolean;
}

export interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: string;
  canSkip?: boolean;
  isOptional?: boolean;
}

export interface CourtSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCourt: (court: Court) => void;
  selectedCourt: Court | null;
}

export interface ValidationInfoCardProps {
  isPastMatch: boolean;
  validationDeadline: Date;
}

export interface MatchPlayerAvatarProps {
  player: {
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url?: string | null;
    isCurrentUser?: boolean;
  } | null;
  team?: 1 | 2;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showBorder?: boolean;
  showTeamIndicator?: boolean;
  isPlaceholder?: boolean;
  showShadow?: boolean;
  onPress?: () => void;
}

export interface TeamPlayerRowProps {
  player: {
    id: string;
    name: string;
    isCurrentUser: boolean;
    email?: string;
    avatar_url?: string | null;
    glicko_rating?: string | null;
  };
  team: 1 | 2;
  showRating?: boolean;
  onRemove?: () => void;
  onSwapTeam?: () => void;
}

export interface ProgressIndicatorProps {
  currentStep: WizardStep;
  totalSteps: number;
  completedSteps: Set<WizardStep>;
  stepConfig: StepConfig[];
  onStepPress: (step: WizardStep) => void;
  canNavigateToStep: (step: WizardStep) => boolean;
}

export interface SlideContainerProps {
  children: React.ReactNode;
  isActive: boolean;
  direction?: "forward" | "backward";
}
