import { NextResponse } from "next/server";
import { fallbackJudge } from "@/lib/judge";

const promptTemplate = (pgn: string) => `
Ты AI Sigma Judge. Проанализируй партию в формате PGN:
${pgn}

Правила ответа:
1) Тон: мемный Gen-Z.
2) Обязательно используй слова: сигма, аура, гигачад, скубиду, риск, 1000 IQ.
3) Не повторяй дословно фразы из прошлых партий, формулировки делай свежими.
4) Дай короткий вердикт (2-3 предложения) с мини-структурой: дебют, миттельшпиль, концовка.
5) Придумай уникальное звание игроку.
6) Верни JSON в формате:
{
  "verdict": "...",
  "title": "...",
  "auraDelta": number (от 5 до 50)
}
`;

const callOpenAI = async (pgn: string) => {
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
      messages: [{ role: "user", content: promptTemplate(pgn) }],
      temperature: 0.9,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return content ? JSON.parse(content) : null;
};

const callGemini = async (pgn: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptTemplate(pgn) }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? JSON.parse(text) : null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pgn = String(body?.pgn ?? "");
    if (!pgn.trim()) {
      return NextResponse.json({ error: "PGN is required" }, { status: 400 });
    }

    let result: { verdict: string; title: string; auraDelta: number } | null = null;
    try {
      result = (await callOpenAI(pgn)) ?? (await callGemini(pgn));
    } catch {
      result = null;
    }

    const safeResult = result ?? fallbackJudge(pgn);
    return NextResponse.json({
      verdict: safeResult.verdict,
      title: safeResult.title,
      auraDelta: Math.max(5, Math.min(50, Number(safeResult.auraDelta || 10))),
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
