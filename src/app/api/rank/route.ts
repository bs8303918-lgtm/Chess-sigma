import { NextResponse } from "next/server";

type RankRequest = {
  games: Array<{
    pgn: string;
    result: "white" | "black" | "draw";
    accuracy?: number;
  }>;
  currentElo?: number | null;
};

const promptTemplate = (payload: RankRequest) => `
Ты AI Rank Judge. Твоя задача: по последним 5 матчам игрока выдать:
1) оценочный рейтинг ELO (целое число 300..2600)
2) уникальное звание (пафосное/мемное, но не кринж), 2-6 слов
3) короткое описание (1-2 предложения) почему такое звание

Данные:
${payload.games
  .slice(0, 5)
  .map((g, i) => `Game ${i + 1}: result=${g.result}, accuracy=${g.accuracy ?? "?"}\nPGN:\n${g.pgn}`)
  .join("\n\n")}

Правила:
- Не используй фиксированные шаблоны типа "Goblin...".
- Делай звание максимально уникальным, опираясь на стиль (точность/ошибки/тактика/позиционка).
- Если игрок ещё некалиброван, выдай более широкий диапазон.

Верни ТОЛЬКО JSON:
{
  "elo": number,
  "title": string,
  "description": string
}
`;

const callOpenAI = async (payload: RankRequest) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: promptTemplate(payload) }],
      temperature: 0.85,
    }),
  });
  if (!response.ok) throw new Error("OpenAI failed");
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return content ? JSON.parse(content) : null;
};

const callGemini = async (payload: RankRequest) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptTemplate(payload) }] }],
        generationConfig: {
          temperature: 0.85,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!response.ok) throw new Error("Gemini failed");
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? JSON.parse(text) : null;
};

const fallbackRank = (payload: RankRequest) => {
  const acc = payload.games.map((g) => g.accuracy ?? 70);
  const avg = acc.reduce((a, b) => a + b, 0) / Math.max(1, acc.length);
  const winScore =
    payload.games.filter((g) => g.result === "white").length -
    payload.games.filter((g) => g.result === "black").length;
  const base = 600 + Math.round((avg - 55) * 18) + winScore * 45;
  const elo = Math.max(300, Math.min(2600, base));
  const title =
    avg > 85 ? "Precision Architect" : avg > 75 ? "Tempo Hunter" : avg > 65 ? "Risk Balancer" : "Chaos Improviser";
  const description =
    avg > 80
      ? "Ты играешь аккуратно и редко отдаёшь темп — сильная база для роста."
      : "У тебя есть идеи и тактика, но стабильность ещё качается. Это норм для старта.";
  return { elo, title, description };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RankRequest;
    const games = Array.isArray(body.games) ? body.games.slice(0, 5) : [];
    if (games.length < 5) return NextResponse.json({ error: "Need 5 games" }, { status: 400 });

    let result: { elo: number; title: string; description: string } | null = null;
    try {
      result = (await callOpenAI({ games })) ?? (await callGemini({ games }));
    } catch {
      result = null;
    }

    const safe = result ?? fallbackRank({ games });
    return NextResponse.json({
      elo: Math.max(300, Math.min(2600, Number(safe.elo || 900))),
      title: String(safe.title || "Unranked"),
      description: String(safe.description || ""),
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

