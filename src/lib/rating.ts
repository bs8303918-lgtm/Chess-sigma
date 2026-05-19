import type { GameReviewStats } from "@/types/game";

const rankTiers = [
  { min: 0, base: "Low Goblin" },
  { min: 500, base: "Goblin" },
  { min: 750, base: "Skilled Goblin" },
  { min: 1000, base: "Goblin-Human Hybrid" },
  { min: 1250, base: "Arena Ranger" },
  { min: 1500, base: "Dungeon Commander" },
  { min: 2000, base: "Worldbreaker Sovereign" },
];

const styleTagFromStats = (stats?: GameReviewStats) => {
  if (!stats) return "Balanced";
  if (stats.great >= 6 || stats.checks >= 6) return "Aggro";
  if (stats.captures >= 8 && stats.blunders <= 1) return "Hunter";
  if (stats.castles > 0 && stats.mistakes <= 2) return "Strategist";
  if (stats.blunders >= 3) return "Chaos";
  return "Adaptive";
};

const styleFlavor = (styleTag: string) => {
  if (styleTag === "Aggro") return "Frontline";
  if (styleTag === "Hunter") return "Sniper";
  if (styleTag === "Strategist") return "Tactician";
  if (styleTag === "Chaos") return "Wildcard";
  return "Wanderer";
};

export const evolveTitle = (elo: number, stats?: GameReviewStats) => {
  const tier = [...rankTiers].reverse().find((it) => elo >= it.min) ?? rankTiers[0];
  const styleTag = styleTagFromStats(stats);
  return `${tier.base} ${styleFlavor(styleTag)} · ${styleTag}`;
};

export const calculateEloDelta = ({
  currentElo,
  opponentElo,
  resultScore,
  gamesPlayed,
}: {
  currentElo: number;
  opponentElo: number;
  resultScore: 0 | 0.5 | 1;
  gamesPlayed: number;
}) => {
  const expected = 1 / (1 + 10 ** ((opponentElo - currentElo) / 400));
  const k = gamesPlayed < 5 ? 56 : 28;
  return Math.round(k * (resultScore - expected));
};
