import { NextResponse } from "next/server";

const fallbackBestMove = "Nf3";
const fallbackRecommendation =
  "Лучший практический ход: Nf3. Развивай коня и готовь рокировку, не открывай короля раньше времени.";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { imageBase64?: string };
    const imageBase64 = String(body.imageBase64 ?? "");
    if (!imageBase64) return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        source: "fallback",
        bestMove: fallbackBestMove,
        recommendation: fallbackRecommendation,
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Recognize chessboard from image and suggest best move for side to move. Return strict JSON: {\"bestMove\":\"...\",\"recommendation\":\"...\"}.",
              },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) throw new Error("vision failed");
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = content ? JSON.parse(content) : {};
    const bestMove =
      typeof parsed.bestMove === "string" && parsed.bestMove.trim() ? parsed.bestMove : fallbackBestMove;
    const recommendation =
      typeof parsed.recommendation === "string" && parsed.recommendation.trim()
        ? parsed.recommendation
        : fallbackRecommendation;
    return NextResponse.json({ source: "openai", bestMove, recommendation });
  } catch {
    return NextResponse.json({
      source: "fallback",
      bestMove: fallbackBestMove,
      recommendation: fallbackRecommendation,
    });
  }
}
