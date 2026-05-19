export type CardRarity = "Common" | "Rare" | "Epic" | "Legendary";

export type GachaCard = {
  id: string;
  name: string;
  rarity: CardRarity;
  image_url: string;
};

export type SigmaJudgeResult = {
  verdict: string;
  title: string;
  auraDelta: number;
};

export type GameRecordPayload = {
  pgn: string;
  result: "white" | "black" | "draw";
  sigmaVerdict: SigmaJudgeResult;
  stats?: GameReviewStats;
};

export type ReviewMove = {
  san: string;
  from: string;
  to: string;
  color: "w" | "b";
  piece: string;
  captured?: string;
  moveNumber: number;
};

export type GameReviewStats = {
  totalMoves: number;
  captures: number;
  checks: number;
  castles: number;
  promotions: number;
  brilliant: number;
  great: number;
  bestMoves: number;
  mistakes: number;
  misses: number;
  blunders: number;
  userAccuracy: number;
  opponentAccuracy: number;
};

export type GameReviewData = {
  positions: string[];
  moves: ReviewMove[];
  stats: GameReviewStats;
  resultText: string;
  userColor: "w" | "b";
};
