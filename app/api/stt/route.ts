import { NextResponse } from "next/server";
import { isLanguageCode, speechCode } from "@/lib/profile";

export async function POST(request: Request) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Set SARVAM_API_KEY." }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const file = form.get("file");
  const language = form.get("language");
  if (!(file instanceof Blob) || file.size === 0 || file.size > 8_000_000 || !isLanguageCode(language)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = new FormData();
  const name = file instanceof File && file.name ? file.name : "speech.webm";
  body.append("file", file, name);
  body.append("model", "saaras:v4");
  body.append("mode", "transcribe");
  body.append("language_code", speechCode(language));

  try {
    const upstream = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      cache: "no-store",
      headers: { "api-subscription-key": key },
      body,
    });
    const payload = (await upstream.json()) as { transcript?: unknown };
    const transcript = typeof payload.transcript === "string" ? payload.transcript.trim() : "";
    if (!upstream.ok || !transcript) {
      return NextResponse.json({ error: "Could not hear that." }, { status: 502 });
    }
    return NextResponse.json({ transcript });
  } catch {
    return NextResponse.json({ error: "Could not hear that." }, { status: 502 });
  }
}
