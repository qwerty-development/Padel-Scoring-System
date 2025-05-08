export interface Profile {
    id: string;
    full_name: string | null;
    email: string;
    glicko_rating?: number;
    friends_list?: string[];
  }
  
  export interface Friend {
    id: string;
    email: string;
    full_name: string | null;
    age: string | null;
    preferred_hand: string | null;
    court_playing_side: string | null;
    glicko_rating: number | null;
  }
  
  export interface MatchData {
    id: string;
    player1_id: string;
    player2_id: string;
    player3_id: string;
    player4_id: string;
    status: number; // 0: scheduled, 1: in progress, 2: completed
    created_at: string;
    completed_at: string | null;
    
    // Set scores
    team1_score_set1: number;
    team2_score_set1: number;
    team1_score_set2: number;
    team2_score_set2: number;
    team1_score_set3: string | null;
    team2_score_set3: string | null;
    
    // Match metadata
    winner_team: number; // 0: tie, 1: team1, 2: team2
    start_time: string | null;
    end_time: string | null;
    region: string | null;
    court: string | null;
    validation_deadline: string | null;
    
    // Player data from relations
    player1: Profile;
    player2: Profile;
    player3: Profile;
    player4: Profile;
  }
  
  export interface FriendRequest {
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: 'pending' | 'accepted' | 'denied';
    created_at: string;
    from_user: {
      id: string;
      full_name: string | null;
      email: string;
    };
    to_user: {
      id: string;
      full_name: string | null;
      email: string;
    };
  }