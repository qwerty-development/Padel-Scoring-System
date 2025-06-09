export interface MatchReport {
  id: string;
  match_id: string;
  reporter_id: string;
  reason: ReportReason;
  additional_details: string | null;
  created_at: string;
  reporter?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export enum ReportReason {
  INCORRECT_SCORE = "incorrect_score",
  WRONG_PLAYERS = "wrong_players",
  MATCH_NOT_PLAYED = "match_not_played",
  DUPLICATE_MATCH = "duplicate_match",
  OTHER = "other",
}

export enum ValidationStatus {
  PENDING = "pending",
  VALIDATED = "validated",
  DISPUTED = "disputed",
  CANCELLED = "cancelled",
}

export interface MatchValidationInfo {
  validation_deadline: string | null;
  validation_status: ValidationStatus;
  rating_applied: boolean;
  disputed_at: string | null;
  report_count: number;
  hours_remaining?: number;
  can_report?: boolean;
  user_has_reported?: boolean;
  reports?: MatchReport[];
}

export interface ReportMatchPayload {
  match_id: string;
  reason: ReportReason;
  additional_details?: string;
}

export interface CanReportResponse {
  can_report: boolean;
  reason: string;
}

export interface ValidationWindowInfo {
  is_open: boolean;
  deadline: Date | null;
  hours_remaining: number;
  minutes_remaining: number;
  status_text: string;
  status_color: string;
}

// Extended Match type with validation info
export interface MatchWithValidation extends Match {
  validation_deadline: string | null;
  validation_status: ValidationStatus;
  rating_applied: boolean;
  disputed_at: string | null;
  report_count: number;
  reports?: MatchReport[];
}

// Helper type guards
export const isMatchDisputed = (match: MatchWithValidation): boolean => {
  return match.validation_status === ValidationStatus.DISPUTED;
};

export const isWithinReportingWindow = (
  match: MatchWithValidation,
): boolean => {
  if (!match.validation_deadline) return false;
  return new Date(match.validation_deadline) > new Date();
};

export const canMatchBeValidated = (match: MatchWithValidation): boolean => {
  return (
    match.validation_status === ValidationStatus.PENDING &&
    match.validation_deadline !== null &&
    new Date(match.validation_deadline) <= new Date()
  );
};
