// Glicko-2 constants
const TAU = 0.5; // Reasonable default
const EPSILON = 0.000001; // Convergence tolerance

export interface GlickoRating {
  rating: number;
  rd: number;
  vol: number;
}

/**
 * Calculate the g-function value
 */
function g(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * rd * rd) / (Math.PI * Math.PI));
}

/**
 * Calculate the E-function (expected score)
 */
function E(rating: number, opponentRating: number, opponentRd: number): number {
  return 1 / (1 + Math.exp((-g(opponentRd) * (rating - opponentRating)) / 400));
}

/**
 * Calculate the v value (variance)
 */
function v(
  rating: number,
  opponentRatings: number[],
  opponentRds: number[],
): number {
  let sum = 0;
  for (let i = 0; i < opponentRatings.length; i++) {
    const e = E(rating, opponentRatings[i], opponentRds[i]);
    const gRd = g(opponentRds[i]);
    sum += gRd * gRd * e * (1 - e);
  }
  return 1 / sum;
}

/**
 * Calculate the delta value
 */
function delta(
  v: number,
  rating: number,
  opponentRatings: number[],
  opponentRds: number[],
  scores: number[],
): number {
  let sum = 0;
  for (let i = 0; i < opponentRatings.length; i++) {
    sum +=
      g(opponentRds[i]) *
      (scores[i] - E(rating, opponentRatings[i], opponentRds[i]));
  }
  return v * sum;
}

/**
 * Helper function for the volatility calculation
 */
function f(
  x: number,
  phi: number,
  v: number,
  delta: number,
  a: number,
): number {
  const ex = Math.exp(x);
  const d2 = delta * delta;
  const phiv = phi * phi + v;

  return (
    (ex * (d2 - phiv - ex)) / (2 * Math.pow(phiv + ex, 2)) -
    (x - a) / (TAU * TAU)
  );
}

/**
 * Calculate updated Glicko-2 rating
 */
export function updateGlicko(
  rating: number,
  rd: number,
  vol: number,
  opponentRatings: number[],
  opponentRds: number[],
  scores: number[],
): GlickoRating {
  // Convert from Glicko to Glicko-2 scale
  let mu = (rating - 1500) / 173.7178;
  let phi = rd / 173.7178;

  if (opponentRatings.length === 0) {
    // If no games played, increase the RD
    phi = Math.sqrt(phi * phi + vol * vol);

    // Convert back to Glicko scale
    rd = phi * 173.7178;
    if (rd > 350) rd = 350; // Cap RD at 350

    return {
      rating: rating,
      rd: rd,
      vol: vol,
    };
  }

  // Step 3: Calculate the variance
  const variance = v(
    mu,
    opponentRatings.map((r) => (r - 1500) / 173.7178),
    opponentRds.map((r) => r / 173.7178),
  );

  // Step 4: Calculate the delta
  const d = delta(
    variance,
    mu,
    opponentRatings.map((r) => (r - 1500) / 173.7178),
    opponentRds.map((r) => r / 173.7178),
    scores,
  );

  // Step 5: Calculate the new volatility (iterative algorithm)
  let a = Math.log(vol * vol);
  let A = a;
  let B = 0;

  if (d * d > phi * phi + variance) {
    B = Math.log(d * d - phi * phi - variance);
  } else {
    let k = 1;
    while (f(a - k * Math.sqrt(TAU * TAU), phi, variance, d, a) < 0) {
      k++;
    }
    B = a - k * Math.sqrt(TAU * TAU);
  }

  // Iterative algorithm
  let fA = f(A, phi, variance, d, a);
  let fB = f(B, phi, variance, d, a);

  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C, phi, variance, d, a);

    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  const newVol = Math.exp(A / 2);

  // Step 6: Update the rating deviation
  phi = Math.sqrt(phi * phi + newVol * newVol);

  // Step 7: Update the rating
  const newPhi = 1 / Math.sqrt(1 / (phi * phi) + 1 / variance);
  const newMu = mu + (newPhi * newPhi * d) / variance;

  // Convert back to Glicko scale
  const newRating = 173.7178 * newMu + 1500;
  const newRd = 173.7178 * newPhi;

  return {
    rating: newRating,
    rd: Math.min(newRd, 350), // Cap RD at 350
    vol: newVol,
  };
}

/**
 * Calculate new ratings for all players after a padel match
 */
export function calculateMatchRatings(
  player1: GlickoRating,
  player2: GlickoRating,
  player3: GlickoRating,
  player4: GlickoRating,
  team1Wins: number,
  team2Wins: number,
): {
  player1: GlickoRating;
  player2: GlickoRating;
  player3: GlickoRating;
  player4: GlickoRating;
} {
  const totalMatches = team1Wins + team2Wins;
  if (totalMatches === 0) {
    return { player1, player2, player3, player4 };
  }

  const team1Result = team1Wins / totalMatches;
  const team2Result = team2Wins / totalMatches;

  const newPlayer1 = updateGlicko(
    player1.rating,
    player1.rd,
    player1.vol,
    [player3.rating, player4.rating],
    [player3.rd, player4.rd],
    [team1Result, team1Result],
  );

  const newPlayer2 = updateGlicko(
    player2.rating,
    player2.rd,
    player2.vol,
    [player3.rating, player4.rating],
    [player3.rd, player4.rd],
    [team1Result, team1Result],
  );

  const newPlayer3 = updateGlicko(
    player3.rating,
    player3.rd,
    player3.vol,
    [player1.rating, player2.rating],
    [player1.rd, player2.rd],
    [team2Result, team2Result],
  );

  const newPlayer4 = updateGlicko(
    player4.rating,
    player4.rd,
    player4.vol,
    [player1.rating, player2.rating],
    [player1.rd, player2.rd],
    [team2Result, team2Result],
  );

  return {
    player1: newPlayer1,
    player2: newPlayer2,
    player3: newPlayer3,
    player4: newPlayer4,
  };
}
