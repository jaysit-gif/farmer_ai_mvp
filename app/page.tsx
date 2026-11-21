"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  LANGUAGES,
  PROFILE_KEY,
  languageLabel,
  parseProfile,
  readProfile,
  saveProfile,
  type ChatTurn,
  type LanguageCode,
  type Profile,
} from "@/lib/profile";

const HELLO: Record<LanguageCode, string> = {
  hi: "नमस्ते",
  te: "నమస్కారం",
  kn: "ನಮಸ್ಕಾರ",
  ta: "வணக்கம்",
  mr: "नमस्कार",
};

type Weather =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; temp: number; label: string; humidity: number; wind: number };

type Place = {
  name?: string;
  latitude: number;
  longitude: number;
  feature_code?: string;
  admin2?: string;
};

function fold(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function pickPlace(query: string, places: Place[]): Place | undefined {
  const ranked = places
    .map((place) => {
      const q = fold(query);
      const name = fold(place.name ?? "");
      const admin = fold(place.admin2 ?? "");
      let rank = name === q ? 20 : name.startsWith(q) ? 8 : -1;
      if (rank < 0) return null;
      if (admin.includes(q)) rank += 10;
      if (place.feature_code === "PPLA2") rank += 6;
      else if (place.feature_code === "PPLA") rank += 5;
      return { place, rank };
    })
    .filter((item): item is { place: Place; rank: number } => item !== null)
    .sort((a, b) => b.rank - a.rank);
  return ranked[0]?.place;
}

function sky(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  return "Storm";
}

const field =
  "mt-1 h-12 w-full rounded-2xl border border-line bg-elevated px-3 text-base text-ink";
const button =
  "inline-flex h-12 items-center justify-center rounded-full bg-accent px-5 text-base font-semibold text-accent-fg touch-manipulation disabled:opacity-60";
function wavBytes(audio: string) {
  const binary = atob(audio);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    setProfile(readProfile());
    setReady(true);
  }, []);

  if (!ready) return <main className="min-h-screen" />;
  if (!profile) {
    return (
      <Onboarding
        onSave={(next) => {
          saveProfile(next);
          setProfile(next);
        }}
      />
    );
  }
  return (
    <Dashboard
      profile={profile}
      onReset={() => {
        localStorage.removeItem(PROFILE_KEY);
        setProfile(null);
      }}
    />
  );
}

function Onboarding({ onSave }: { onSave: (profile: Profile) => void }) {
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [crop, setCrop] = useState("");
  const [language, setLanguage] = useState<LanguageCode>("hi");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = parseProfile({ name, district, crop, language });
    if (!next) {
      setError("Fill in every field.");
      return;
    }
    onSave(next);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-8">
      <h1 className="font-serif text-4xl text-ink">Farmer AI</h1>
      <p className="mt-2 text-lg text-muted">Tell us about your farm.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-ink">
          Name
          <input className={field} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </label>
        <label className="block text-sm font-semibold text-ink">
          District
          <input className={field} value={district} maxLength={80} onChange={(event) => setDistrict(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Crop
          <input className={field} value={crop} maxLength={80} onChange={(event) => setCrop(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Language
          <select
            className={field}
            value={language}
            onChange={(event) => setLanguage(event.target.value as LanguageCode)}
          >
            {LANGUAGES.map((item) => (
              <option key={item.code} value={item.code} lang={item.code}>
                {item.native} ({item.label})
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="text-sm font-semibold text-wheat">{error}</p> : null}
        <button className={`${button} w-full`} type="submit">
          Start
        </button>
      </form>
    </main>
  );
}

function Dashboard({ profile, onReset }: { profile: Profile; onReset: () => void }) {
  const [weather, setWeather] = useState<Weather>({ status: "loading" });
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatTurn[]>([]);
  const pendingRef = useRef(false);
  const recordingRef = useRef(false);
  const startingRef = useRef(false);
  const turnRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const transcribeRef = useRef<(blob: Blob) => Promise<void>>(async () => {});

  function setBusy(value: boolean) {
    pendingRef.current = value;
    setPending(value);
  }

  function stopSpeech() {
    const source = sourceRef.current;
    sourceRef.current = null;
    if (!source) return;
    try {
      source.stop();
    } catch {
      return;
    }
  }

  function armAudio() {
    const ctx = audioRef.current ?? new AudioContext();
    audioRef.current = ctx;
    if (ctx.state === "suspended") void ctx.resume();
  }

  useEffect(() => {
    const controller = new AbortController();
    setWeather({ status: "loading" });
    (async () => {
      try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(profile.district)}&count=10&language=en&format=json&countryCode=IN`;
        const geoRes = await fetch(geoUrl, { signal: controller.signal });
        const geo = (await geoRes.json()) as { results?: Place[] };
        const place = pickPlace(profile.district, geo.results ?? []);
        if (!place) {
          setWeather({ status: "error" });
          return;
        }
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
        const weatherRes = await fetch(weatherUrl, { signal: controller.signal });
        const data = (await weatherRes.json()) as {
          current?: {
            temperature_2m?: number;
            relative_humidity_2m?: number;
            weather_code?: number;
            wind_speed_10m?: number;
          };
        };
        const current = data.current;
        if (
          !current ||
          typeof current.temperature_2m !== "number" ||
          typeof current.relative_humidity_2m !== "number" ||
          typeof current.weather_code !== "number" ||
          typeof current.wind_speed_10m !== "number"
        ) {
          setWeather({ status: "error" });
          return;
        }
        setWeather({
          status: "ready",
          temp: Math.round(current.temperature_2m),
          label: sky(current.weather_code),
          humidity: Math.round(current.relative_humidity_2m),
          wind: Math.round(current.wind_speed_10m),
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setWeather({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [profile.district]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
      stopSpeech();
      void audioRef.current?.close();
    };
  }, []);

  async function speak(text: string, turn: number) {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: profile.language }),
      });
      const payload = (await response.json()) as { audio?: string; error?: string };
      if (turn !== turnRef.current) return;
      if (!response.ok || !payload.audio) {
        setError(payload.error || "Could not play the reply.");
        return;
      }
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const buffer = await ctx.decodeAudioData(wavBytes(payload.audio));
      if (turn !== turnRef.current) return;
      stopSpeech();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      sourceRef.current = source;
      source.start();
    } catch {
      if (turn === turnRef.current) setError("Could not play the reply.");
    }
  }

  async function send(text: string) {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (!trimmed || pendingRef.current || recordingRef.current) return;
    const turn = ++turnRef.current;
    stopSpeech();
    const history = [...messagesRef.current, { role: "user" as const, content: trimmed.slice(0, 2000) }];
    messagesRef.current = history;
    setMessages(history);
    setDraft("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, messages: history }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      if (turn !== turnRef.current) return;
      if (!response.ok || !payload.reply) {
        setError(payload.error || "The advisor could not answer.");
        return;
      }
      const next = [...history, { role: "assistant" as const, content: payload.reply }];
      messagesRef.current = next;
      setMessages(next);
      setBusy(false);
      await speak(payload.reply, turn);
    } catch {
      if (turn === turnRef.current) setError("The advisor could not answer.");
    } finally {
      if (turn === turnRef.current) setBusy(false);
    }
  }

  async function transcribe(blob: Blob) {
    const turn = ++turnRef.current;
    setBusy(true);
    setError("");
    try {
      const type = blob.type || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : "webm";
      const body = new FormData();
      body.append("file", new File([blob], `speech.${ext}`, { type }), `speech.${ext}`);
      body.append("language", profile.language);
      const response = await fetch("/api/stt", { method: "POST", body });
      const payload = (await response.json()) as { transcript?: string; error?: string };
      if (turn !== turnRef.current) return;
      const transcript = payload.transcript?.trim() ?? "";
      if (!response.ok || !transcript) {
        setError(payload.error || "Could not hear that.");
        return;
      }
      pendingRef.current = false;
      await send(transcript);
    } catch {
      if (turn === turnRef.current) setError("Could not hear that.");
    } finally {
      if (turn === turnRef.current) setBusy(false);
    }
  }

  transcribeRef.current = transcribe;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (recordingRef.current) return;
    armAudio();
    void send(draft);
  }

  async function toggleMic() {
    if (pendingRef.current || startingRef.current) return;
    const active = recorderRef.current;
    if (active && active.state === "recording") {
      active.stop();
      return;
    }
    startingRef.current = true;
    armAudio();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      startingRef.current = false;
      setError("Could not use the microphone.");
      return;
    }
    try {
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((item) =>
        MediaRecorder.isTypeSupported(item),
      );
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        recorderRef.current = null;
        recordingRef.current = false;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || "audio/webm" });
        chunksRef.current = [];
        if (!blob.size) {
          setError("Could not hear that.");
          return;
        }
        void transcribeRef.current(blob);
      };
      recorderRef.current = recorder;
      recordingRef.current = true;
      recorder.start();
      setRecording(true);
      timerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 20000);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      recordingRef.current = false;
      setRecording(false);
      setError("Could not use the microphone.");
    } finally {
      startingRef.current = false;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 px-4 py-5">
      <header>
        <h1 className="font-serif text-3xl leading-tight text-ink" lang={profile.language}>
          {HELLO[profile.language]}, {profile.name}
        </h1>
        <p className="mt-1 text-base text-muted">
          {profile.crop} · {profile.district} · {languageLabel(profile.language)}
        </p>
        <button type="button" onClick={onReset} className="mt-2 text-sm font-semibold text-wheat">
          Start over
        </button>
      </header>

      <section className="rounded-3xl border border-line bg-elevated p-4" aria-label="Weather">
        {weather.status === "loading" ? <p className="text-lg text-muted">Loading weather…</p> : null}
        {weather.status === "error" ? (
          <p className="text-lg text-muted">No weather for this district.</p>
        ) : null}
        {weather.status === "ready" ? (
          <>
            <p className="text-sm font-semibold text-wheat">{profile.district}</p>
            <p className="mt-1 font-serif text-5xl text-ink">{weather.temp}°C</p>
            <p className="mt-1 text-lg text-ink">{weather.label}</p>
            <p className="mt-1 text-base text-muted">
              Humidity {weather.humidity}% · Wind {weather.wind} km/h
            </p>
          </>
        ) : null}
      </section>

      <section className="flex min-h-64 flex-1 flex-col rounded-3xl border border-line bg-elevated" aria-label="Chat">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-lg text-muted">Ask about your crop.</p>
          ) : null}
          {messages.map((message, index) => (
            <p
              key={`${message.role}-${index}`}
              lang={message.role === "assistant" ? profile.language : undefined}
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-base leading-relaxed ${
                message.role === "user"
                  ? "ml-auto bg-accent-soft text-ink"
                  : "bg-canvas text-ink"
              }`}
            >
              {message.content}
            </p>
          ))}
          {pending ? <p className="text-base text-muted">Thinking…</p> : null}
          {error ? <p className="text-sm font-semibold text-wheat">{error}</p> : null}
          <div ref={bottom} />
        </div>
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
          <label className="sr-only" htmlFor="question">
            Question
          </label>
          <textarea
            id="question"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            className="min-h-12 flex-1 resize-none rounded-2xl border border-line bg-canvas px-3 py-2 text-base text-ink"
          />
          <button
            type="button"
            aria-label={recording ? "Stop recording" : "Record a question"}
            aria-pressed={recording}
            disabled={pending}
            onClick={() => void toggleMic()}
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line touch-manipulation disabled:opacity-60 ${
              recording ? "bg-accent text-accent-fg" : "bg-canvas text-ink"
            }`}
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </button>
          <button className={button} type="submit" disabled={pending || recording || !draft.trim()}>
            Send
          </button>
        </form>
      </section>
    </main>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  );
}
