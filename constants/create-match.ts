import { Court } from "@/types/create-match";

// ENHANCEMENT: Validation configuration constants
export const VALIDATION_CONFIG = {
  DISPUTE_WINDOW_HOURS: 24,
  DISPUTE_THRESHOLD: 2,
  MIN_MATCH_AGE_DAYS: 7,
  MAX_FUTURE_DAYS: 30,
  RATING_CALCULATION_DELAY_MS: 1000,
  VALIDATION_WARNING_HOURS: 6,
  QUICK_VALIDATION_HOURS: 1, // For testing/demo purposes
};

// PREDEFINED COURTS DATA
export const PREDEFINED_COURTS: Court[] = [
  // Dubai Courts
  {
    id: "dub-001",
    name: "The Padel Lab",
    region: "Dubai",
    area: "Al Quoz",
    type: "indoor",
  },
  {
    id: "dub-002",
    name: "Just Padel",
    region: "Dubai",
    area: "Business Bay",
    type: "indoor",
  },
  {
    id: "dub-003",
    name: "Padel Pro Dubai",
    region: "Dubai",
    area: "Dubai Sports City",
    type: "outdoor",
  },
  {
    id: "dub-004",
    name: "The Smash Room",
    region: "Dubai",
    area: "JLT",
    type: "indoor",
  },
  {
    id: "dub-005",
    name: "ISD Sports City",
    region: "Dubai",
    area: "Dubai Sports City",
    type: "outdoor",
  },
  {
    id: "dub-006",
    name: "Real Padel Club",
    region: "Dubai",
    area: "Al Barsha",
    type: "indoor",
  },
  {
    id: "dub-007",
    name: "Dubai Padel Academy",
    region: "Dubai",
    area: "Al Khawaneej",
    type: "outdoor",
  },
  {
    id: "dub-008",
    name: "Reform Athletica",
    region: "Dubai",
    area: "Dubai Design District",
    type: "indoor",
  },

  // Abu Dhabi Courts
  {
    id: "ad-001",
    name: "Zayed Sports City",
    region: "Abu Dhabi",
    area: "Zayed City",
    type: "outdoor",
  },
  {
    id: "ad-002",
    name: "Al Forsan Padel",
    region: "Abu Dhabi",
    area: "Khalifa City",
    type: "outdoor",
  },
  {
    id: "ad-003",
    name: "NYU Abu Dhabi",
    region: "Abu Dhabi",
    area: "Saadiyat Island",
    type: "indoor",
  },
  {
    id: "ad-004",
    name: "Yas Marina Circuit",
    region: "Abu Dhabi",
    area: "Yas Island",
    type: "outdoor",
  },

  // Sharjah Courts
  {
    id: "shj-001",
    name: "Sharjah Golf & Shooting Club",
    region: "Sharjah",
    area: "Al Dhaid",
    type: "outdoor",
  },
  {
    id: "shj-002",
    name: "Al Jazeera Cultural Club",
    region: "Sharjah",
    area: "Al Majaz",
    type: "indoor",
  },

  // Ajman Courts
  {
    id: "ajm-001",
    name: "Ajman Club",
    region: "Ajman",
    area: "Al Jurf",
    type: "outdoor",
  },

  // Generic Courts (for other areas)
  {
    id: "gen-001",
    name: "Community Court 1",
    region: "Other",
    area: "Community Center",
    type: "outdoor",
  },
  {
    id: "gen-002",
    name: "Community Court 2",
    region: "Other",
    area: "Community Center",
    type: "outdoor",
  },
  {
    id: "gen-003",
    name: "Sports Complex A",
    region: "Other",
    area: "Sports District",
    type: "indoor",
  },
  {
    id: "gen-004",
    name: "Sports Complex B",
    region: "Other",
    area: "Sports District",
    type: "outdoor",
  },
  {
    id: "gen-005",
    name: "Local Recreation Center",
    region: "Other",
    area: "Residential Area",
    type: "indoor",
  },
];
