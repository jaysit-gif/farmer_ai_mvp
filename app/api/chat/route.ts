import { NextResponse } from "next/server";
import {
  languageLabel,
  parseProfile,
  type ChatTurn,
} from "@/lib/profile";

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > max) return null;
  return text;
}

function parseMessages(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) return null;
  const turns: ChatTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (row.role !== "user" && row.role !== "assistant") return null;
    const content = clean(row.content, 2000);
    if (!content) return null;
    turns.push({ role: row.role, content });
  }
  if (turns[turns.length - 1]?.role !== "user") return null;
  return turns;
}

function replyText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { choices?: { message?: { content?: unknown } }[] })
    .choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

async function complete(messages: { role: string; content: string }[]) {
  const sarvamKey = process.env.SARVAM_API_KEY;
  if (sarvamKey) {
    return fetch("https://api.sarvam.ai/v2/chat/completions", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": sarvamKey,
      },
      body: JSON.stringify({
        model: "sarvam-105b",
        messages,
        temperature: 0.4,
      }),
    });
  }

  const key = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  const base = (process.env.OPENAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, "");
  return fetch(`${base}/chat/completions`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "grok-4.7",
      messages,
      temperature: 0.4,
    }),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const profile = parseProfile(row.profile);
  const messages = parseMessages(row.messages);
  if (!profile || !messages) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const upstream = await complete([
    {
      role: "system",
      content: `You advise a small farmer in India. Name: ${profile.name}. District: ${profile.district}. Crop: ${profile.crop}. Reply only in ${languageLabel(profile.language)}. Use a few short practical steps. Do not invent pesticide doses.`,
    },
    ...messages,
  ]);

  if (!upstream) {
    return NextResponse.json(
      { error: "Set SARVAM_API_KEY or XAI_API_KEY." },
      { status: 500 },
    );
  }

  try {
    const payload = await upstream.json();
    const reply = replyText(payload);
    if (!upstream.ok || !reply) {
      return NextResponse.json({ error: "The advisor could not answer." }, { status: 502 });
    }
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "The advisor could not answer." }, { status: 502 });
  }
}
