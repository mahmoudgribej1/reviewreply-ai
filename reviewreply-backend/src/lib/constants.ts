// ─────────────────────────────────────────────
// Shared application constants
// ─────────────────────────────────────────────

/** Max AI reply generations per 30-day period on the Free plan */
export const FREE_GENERATION_LIMIT = 30;

/** Business type options (used in onboarding + settings) */
export const BUSINESS_TYPES = [
  "Restaurant / Café",
  "Hotel / Accommodation",
  "Retail Store",
  "Hair / Beauty Salon",
  "Health / Medical",
  "Auto / Mechanic",
  "Home Services",
  "Professional Services",
  "Fitness / Gym",
  "Other",
] as const;

/** Tone options for AI reply generation */
export const TONE_OPTIONS = [
  "Professional",
  "Friendly & Casual",
  "Empathetic & Understanding",
  "Enthusiastic",
  "Short & Direct",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type ToneOption = (typeof TONE_OPTIONS)[number];
