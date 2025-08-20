import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import {
  MatchData,
  UserStats,
  FriendActivity,
  CategorizedMatches,
  MatchStatus,
} from "@/types/dashboard";

export const useDashboardData = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([]);
  const { profile, session } = useAuth();

  // Enhanced user stats calculation
  const userStats = useMemo((): UserStats => {
    if (!matches.length || !session?.user?.id) {
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageMatchDuration: 0,
        recentPerformance: "stable",
        ratingChange7Days: 0,
        ratingChange30Days: 0,
        publicMatches: 0,
        privateMatches: 0,
        needsConfirmation: 0,
        disputed: 0,
      };
    }

    const completedMatches = matches
      .filter(
        (match) =>
          match.team1_score_set1 !== null && match.team2_score_set1 !== null,
      )
      .sort(
        (a, b) =>
          new Date(a.completed_at || a.end_time || a.start_time).getTime() -
          new Date(b.completed_at || b.end_time || b.start_time).getTime(),
      );

    let wins = 0;
    let losses = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let totalDuration = 0;
    let matchesWithDuration = 0;
    let publicMatches = 0;
    let privateMatches = 0;
    let needsConfirmation = 0;
    let disputed = 0;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let recentWins = 0;
    let recentMatches = 0;
    let olderWins = 0;
    let olderMatches = 0;

    matches.forEach((match) => {
      // Count match types
      if (match.is_public) publicMatches++;
      else privateMatches++;

      // Count confirmation status
      if (match.needsConfirmation) needsConfirmation++;
      if (match.isDisputed) disputed++;
    });

    completedMatches.forEach((match, index) => {
      const isTeam1 =
        match.player1_id === session.user.id ||
        match.player2_id === session.user.id;

      let userWon = false;

      if (match.winner_team) {
        userWon =
          (isTeam1 && match.winner_team === 1) ||
          (!isTeam1 && match.winner_team === 2);
      } else {
        let team1Sets = 0;
        let team2Sets = 0;

        const set1Team1 = match.team1_score_set1 as number;
        const set1Team2 = match.team2_score_set1 as number;
        if (set1Team1 > set1Team2) team1Sets++;
        else if (set1Team2 > set1Team1) team2Sets++;

        if (
          match.team1_score_set2 !== null &&
          match.team2_score_set2 !== null
        ) {
          if (match.team1_score_set2 > match.team2_score_set2) team1Sets++;
          else if (match.team2_score_set2 > match.team1_score_set2) team2Sets++;
        }

        if (
          match.team1_score_set3 !== null &&
          match.team2_score_set3 !== null
        ) {
          if (match.team1_score_set3 > match.team2_score_set3) team1Sets++;
          else if (match.team2_score_set3 > match.team1_score_set3) team2Sets++;
        }

        userWon =
          (isTeam1 && team1Sets > team2Sets) ||
          (!isTeam1 && team2Sets > team1Sets);
      }

      const matchDate = new Date(
        match.completed_at || match.end_time || match.start_time,
      );

      // Calculate recent vs older performance
      if (matchDate >= sevenDaysAgo) {
        recentMatches++;
        if (userWon) recentWins++;
      } else if (matchDate >= thirtyDaysAgo) {
        olderMatches++;
        if (userWon) olderWins++;
      }

      if (userWon) {
        wins++;
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      } else {
        losses++;
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      }

      if (Math.abs(currentStreak) > Math.abs(longestStreak)) {
        longestStreak = currentStreak;
      }

      // Calculate duration
      if (match.start_time && match.end_time) {
        const duration =
          new Date(match.end_time).getTime() -
          new Date(match.start_time).getTime();
        totalDuration += duration;
        matchesWithDuration++;
      }
    });

    // Determine performance trend
    let recentPerformance: "improving" | "declining" | "stable" = "stable";
    if (recentMatches >= 2 && olderMatches >= 2) {
      const recentWinRate = recentWins / recentMatches;
      const olderWinRate = olderWins / olderMatches;
      if (recentWinRate > olderWinRate + 0.1) {
        recentPerformance = "improving";
      } else if (recentWinRate < olderWinRate - 0.1) {
        recentPerformance = "declining";
      }
    }

    return {
      totalMatches: wins + losses,
      wins,
      losses,
      winRate:
        wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      currentStreak,
      longestStreak,
      averageMatchDuration:
        matchesWithDuration > 0 ? totalDuration / matchesWithDuration : 0,
      recentPerformance,
      ratingChange7Days: 0, // TODO: Calculate from rating history
      ratingChange30Days: 0, // TODO: Calculate from rating history
      publicMatches,
      privateMatches,
      needsConfirmation,
      disputed,
    };
  }, [matches, session?.user?.id]);

  // Enhanced match categorization
  const categorizedMatches = useMemo((): CategorizedMatches => {
    if (!matches.length) {
      return {
        upcoming: [],
        needsAttention: [],
        recent: [],
        thisWeek: [],
        publicMatches: [],
        needsConfirmation: [],
        disputed: [],
      };
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      upcoming: matches
        .filter((match) => {
          const startTime = new Date(match.start_time);
          return startTime > now && match.status !== MatchStatus.CANCELLED;
        })
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        )
        .slice(0, 5),

      needsAttention: matches
        .filter((match) => {
          const startTime = new Date(match.start_time);
          const endTime = match.end_time ? new Date(match.end_time) : null;
          const isPast = endTime ? endTime < now : startTime < now;
          const hasNoScores =
            !match.team1_score_set1 && !match.team2_score_set1;
          return (
            (isPast && hasNoScores && match.status !== MatchStatus.CANCELLED) ||
            match.needsConfirmation ||
            match.isDisputed
          );
        })
        .sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
        )
        .slice(0, 5),

      recent: matches
        .filter(
          (match) =>
            match.team1_score_set1 !== null && match.team2_score_set1 !== null,
        )
        .sort((a, b) => {
          const dateA = new Date(a.completed_at || a.end_time || a.start_time);
          const dateB = new Date(b.completed_at || b.end_time || b.start_time);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5),

      thisWeek: matches.filter((match) => {
        const hasScores =
          match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const matchDate = new Date(
          match.completed_at || match.end_time || match.start_time,
        );
        return matchDate >= weekAgo && hasScores;
      }),

      publicMatches: matches
        .filter((match) => {
          const startTime = new Date(match.start_time);
          return match.is_public && startTime > now;
        })
        .slice(0, 3),

      needsConfirmation: matches
        .filter((match) => match.needsConfirmation)
        .slice(0, 3),

      disputed: matches.filter((match) => match.isDisputed).slice(0, 3),
    };
  }, [matches]);

  const fetchData = async (shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch matches with enhanced player information
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          `
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, avatar_url)
        `,
        )
        .or(
          `player1_id.eq.${session?.user?.id},player2_id.eq.${session?.user?.id},player3_id.eq.${session?.user?.id},player4_id.eq.${session?.user?.id}`,
        )
        .order("start_time", { ascending: false });

      if (matchError) throw matchError;

      // Process match data with enhanced computed properties
      const processedMatches = (matchData || []).map((match) => {
        const userId = session?.user?.id;
        const now = new Date();
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;

        const isTeam1 =
          match.player1_id === userId || match.player2_id === userId;
        const isFuture = startTime > now;
        const isPast = endTime ? endTime < now : startTime < now;
        const hasScores =
          match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const isCompleted = hasScores && isPast;
        const needsScores =
          isPast && !hasScores && match.status !== MatchStatus.CANCELLED;

        // Enhanced confirmation logic
        const statusNum =
          typeof match.status === "string"
            ? parseInt(match.status, 10)
            : match.status;
        const needsConfirmation =
          statusNum === 4 &&
          hasScores &&
          match.confirmation_status === "pending" &&
          !match.all_confirmed;
        const isDisputed =
          match.validation_status === "disputed" ||
          match.confirmation_status === "rejected";

        // Enhanced teammate and opponent identification
        let teammate = null;
        let opponents: any[] = [];

        if (isTeam1) {
          teammate =
            match.player1_id === userId ? match.player2 : match.player1;
          opponents = [match.player3, match.player4].filter(Boolean);
        } else {
          teammate =
            match.player3_id === userId ? match.player4 : match.player3;
          opponents = [match.player1, match.player2].filter(Boolean);
        }

        let userWon = false;
        let setScores = "";
        let team1Sets = 0;
        let team2Sets = 0;

        if (hasScores) {
          // Set-based winner calculation
          if (match.team1_score_set1 > match.team2_score_set1) team1Sets++;
          else if (match.team2_score_set1 > match.team1_score_set1) team2Sets++;

          if (
            match.team1_score_set2 !== null &&
            match.team2_score_set2 !== null
          ) {
            if (match.team1_score_set2 > match.team2_score_set2) team1Sets++;
            else if (match.team2_score_set2 > match.team1_score_set2)
              team2Sets++;
          }

          if (
            match.team1_score_set3 !== null &&
            match.team2_score_set3 !== null
          ) {
            if (match.team1_score_set3 > match.team2_score_set3) team1Sets++;
            else if (match.team2_score_set3 > match.team1_score_set3)
              team2Sets++;
          }

          if (match.winner_team) {
            userWon =
              (isTeam1 && match.winner_team === 1) ||
              (!isTeam1 && match.winner_team === 2);
          } else {
            userWon =
              (isTeam1 && team1Sets > team2Sets) ||
              (!isTeam1 && team2Sets > team1Sets);
          }

          // Create readable set scores
          const userSet1 = isTeam1
            ? match.team1_score_set1
            : match.team2_score_set1;
          const oppSet1 = isTeam1
            ? match.team2_score_set1
            : match.team1_score_set1;
          setScores = `${userSet1}-${oppSet1}`;

          if (
            match.team1_score_set2 !== null &&
            match.team2_score_set2 !== null
          ) {
            const userSet2 = isTeam1
              ? match.team1_score_set2
              : match.team2_score_set2;
            const oppSet2 = isTeam1
              ? match.team2_score_set2
              : match.team1_score_set2;
            setScores += `, ${userSet2}-${oppSet2}`;

            if (
              match.team1_score_set3 !== null &&
              match.team2_score_set3 !== null
            ) {
              const userSet3 = isTeam1
                ? match.team1_score_set3
                : match.team2_score_set3;
              const oppSet3 = isTeam1
                ? match.team2_score_set3
                : match.team1_score_set3;
              setScores += `, ${userSet3}-${oppSet3}`;
            }
          }
        }

        return {
          ...match,
          isTeam1,
          userWon,
          setScores,
          isCompleted,
          isFuture,
          isPast,
          needsScores,
          needsConfirmation,
          isDisputed,
          teammate,
          opponents,
          team1Sets,
          team2Sets,
        };
      });

      setMatches(processedMatches);

      // Fetch friends activity with enhanced information
      if (profile?.friends_list && profile.friends_list.length > 0) {
        const { data: friendsData, error: friendsError } = await supabase
          .from("profiles")
          .select("id, full_name, email, glicko_rating, avatar_url, updated_at")
          .in("id", profile.friends_list);

        if (!friendsError && friendsData) {
          setFriendsActivity(friendsData.slice(0, 5));
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchData();
    }
  }, [session]);

  const onRefresh = () => {
    fetchData(true);
  };

  return {
    loading,
    refreshing,
    matches,
    friendsActivity,
    userStats,
    categorizedMatches,
    fetchData,
    onRefresh,
  };
};
