import type { SigmaJudgeResult } from "@/types/game";

const memeTitles = [
  "Sigma Grandmaster",
  "GigaChad Tactician",
  "Skubidu Gambit Lord",
  "1000 IQ Endgame Beast",
  "Clown of the Board",
  "Aura Farming Architect",
  "Risk Manager Supreme",
  "No-Cap Knight Whisperer",
  "Chaos CEO of Chess",
];

const openings = [
  "Дебют зашел как чистый сигма-плей",
  "Старт был на ауре, без лишней паники",
  "Первые ходы выглядели как 1000 IQ сценарий",
  "В начале ты устроил легкий скубиду-хаос, но контролируемый",
];

const middles = [
  "в миттельшпиле ты включил риск и разорвал центр",
  "середина партии была гигачад давлением по всем линиям",
  "в центре доски ты фармил темп и ауру одновременно",
  "тут был момент 'или пан, или риск', и ты не сдал назад",
];

const endings = [
  "финиш оформлен в стиле no-cap: четко и уверенно.",
  "концовка получилась мемной, но с точным расчетом 1000 IQ.",
  "эндшпиль закрыл как настоящий гигачад, без токсика.",
  "развязка: скубиду-энергия плюс холодный сигма-контроль.",
];

const hashPgn = (pgn: string) =>
  pgn.split("").reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1_000_003, 7);

export const fallbackJudge = (pgn: string): SigmaJudgeResult => {
  const moveCount = Math.max(1, pgn.split(" ").filter((t) => t.includes(".")).length);
  const auraDelta = Math.min(40, Math.max(8, Math.round(moveCount / 2)));
  const seed = hashPgn(pgn) + Math.floor(Date.now() / 60_000);
  const pick = (arr: string[], offset: number) => arr[(seed + offset) % arr.length];
  const verdict = `${pick(openings, 0)}: ${pick(middles, 3)}, а ${pick(endings, 5)}`;
  const title = pick(memeTitles, 9);

  return { verdict, title, auraDelta };
};
