/**
 * Units module (Requirement 2).
 *
 * The only place SI <-> display conversion happens. Domain modules work in
 * SI (m, N, Pa, kg) and must not import from here. Pure, no dependencies.
 */

/** m -> mm (×10³). */
export const mToMm = (m: number): number => m * 1e3;
/** mm -> m (÷10³). */
export const mmToM = (mm: number): number => mm / 1e3;
/** Pa -> MPa (÷10⁶). */
export const paToMpa = (pa: number): number => pa / 1e6;
/** m⁴ -> mm⁴ (×10¹²). */
export const m4ToMm4 = (m4: number): number => m4 * 1e12;
/** m² -> mm² (×10⁶). */
export const m2ToMm2 = (m2: number): number => m2 * 1e6;

/** Radians to degrees, for displaying stored angles such as shaft twist (task 47.3). */
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Plain decimal: optional sign (+ or -), digits, optional single decimal
 * point. At least one digit is required, so "12", "-3.5", ".5", and "5." are
 * accepted; ".", "-", "1e3", "1,200", "12mm", "0x10", "NaN", "Infinity" are not.
 */
const DECIMAL_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Parses user text as millimetres. Returns the number in mm, or null for
 * empty, whitespace-only, non-numeric, or non-finite input. Never throws.
 */
export function parseMmInput(text: string): number | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!DECIMAL_RE.test(trimmed)) return null;
  const value = Number(trimmed);
  // Very long digit strings can overflow to Infinity.
  return Number.isFinite(value) ? value : null;
}

/** Shown when a value cannot be displayed (NaN, ±Infinity). */
export const UNAVAILABLE_PLACEHOLDER = "—";

const DEFAULT_DIGITS = 2;
const MAX_DIGITS = 6;

/** Normalizes precision to an integer in 0..6; non-finite falls back to 2. */
function normalizeDigits(digits: number): number {
  if (!Number.isFinite(digits)) return DEFAULT_DIGITS;
  return Math.min(MAX_DIGITS, Math.max(0, Math.trunc(digits)));
}

/**
 * Formats a length in metres as millimetres with exactly `digits` decimals.
 * Uses `toFixed` (locale-independent: "." separator, no grouping). Negative
 * values that round to zero are shown without a sign ("0.00", not "-0.00").
 * Non-finite input returns UNAVAILABLE_PLACEHOLDER. Never throws.
 */
export function formatMm(m: number, digits: number = DEFAULT_DIGITS): string {
  if (typeof m !== "number" || !Number.isFinite(m)) return UNAVAILABLE_PLACEHOLDER;
  const d = normalizeDigits(digits);
  const mm = mToMm(m);
  // toFixed switches to exponent notation at |mm| >= 1e21 and mm overflows to
  // Infinity above ~1.8e305 m. Such m are integers (>= 2^53), so format the
  // exact product with BigInt to keep plain digits (Req 2.5).
  if (!(Math.abs(mm) < 1e21)) {
    const integer = (BigInt(m) * 1000n).toString();
    return d === 0 ? integer : `${integer}.${"0".repeat(d)}`;
  }
  const text = mm.toFixed(d);
  // Strip the sign from a negative zero result such as "-0.00".
  return /^-0(?:\.0*)?$/.test(text) ? text.slice(1) : text;
}
