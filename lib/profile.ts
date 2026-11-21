export const PROFILE_KEY = "farmer-ai-profile";

export const LANGUAGES = [
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "mr", label: "Marathi", native: "मराठी" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export type Profile = {
  name: string;
  district: string;
  crop: string;
  language: LanguageCode;
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

export function languageLabel(code: LanguageCode): string {
  return LANGUAGES.find((language) => language.code === code)?.label ?? "Hindi";
}

const SPEECH_CODES: Record<LanguageCode, string> = {
  hi: "hi-IN",
  te: "te-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  mr: "mr-IN",
};

export function speechCode(code: LanguageCode): string {
  return SPEECH_CODES[code];
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > max) return null;
  return text;
}

export function parseProfile(value: unknown): Profile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const name = clean(row.name, 80);
  const district = clean(row.district, 80);
  const crop = clean(row.crop, 80);
  if (!name || !district || !crop || !isLanguageCode(row.language)) return null;
  return { name, district, crop, language: row.language };
}

export function readProfile(): Profile | null {
  try {
    return parseProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? ""));
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
