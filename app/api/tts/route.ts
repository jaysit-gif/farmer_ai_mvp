import { NextResponse } from "next/server";
import { isLanguageCode, speechCode } from "@/lib/profile";

export async function POST(request: Request) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Set SARVAM_API_KEY." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = typeof row.text === "string" ? row.text.replace(/\s+/g, " ").trim() : "";
  if (!text || !isLanguageCode(row.language)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const upstream = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": key,
      },
      body: JSON.stringify({
        text: text.slice(0, 2500),
        language_code: speechCode(row.language),
        model: "bulbul:v4-flash",
        speaker: "shubh_enhi_ads",
      }),
    });
    const payload = (await upstream.json()) as { audios?: unknown };
    const audio = Array.isArray(payload.audios)
      ? payload.audios.filter((part): part is string => typeof part === "string").join("")
      : "";
    if (!upstream.ok || !audio) {
      return NextResponse.json({ error: "Could not play the reply." }, { status: 502 });
    }
    return NextResponse.json({ audio });
  } catch {
    return NextResponse.json({ error: "Could not play the reply." }, { status: 502 });
  }
}
