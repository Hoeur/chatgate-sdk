/**
 * Schemes considered safe for navigation targets built from server or peer supplied data.
 */
export const CHATGATE_SAFE_URL_SCHEMES = ["http:", "https:", "mailto:", "tel:"] as const;

export type ChatGateSafeUrlScheme = (typeof CHATGATE_SAFE_URL_SCHEMES)[number];

export interface ChatGateSanitizeUrlOptions {
  /** Schemes accepted for absolute URLs. Defaults to {@link CHATGATE_SAFE_URL_SCHEMES}. */
  schemes?: readonly string[];
  /** Allow scheme-relative (`//host/path`) and path-relative values. Defaults to true. */
  allowRelative?: boolean;
}

/** C0/C1 controls, line separators, and invisible formatting marks (zero-width, bidi overrides, BOM). */
const IGNORED_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Returns the URL when it targets an allowed scheme, otherwise `undefined`.
 * Blocks `javascript:`, `data:`, `vbscript:`, `file:` and any other unlisted scheme,
 * including values obfuscated with control characters, zero-width/bidi marks or leading whitespace.
 */
export function sanitizeUrl(
  value: string | null | undefined,
  options: ChatGateSanitizeUrlOptions = {},
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(IGNORED_CHARACTERS, "").trim();
  if (!trimmed) return undefined;

  const schemes = options.schemes ?? CHATGATE_SAFE_URL_SCHEMES;
  const match = SCHEME_PREFIX.exec(trimmed);
  if (match) {
    const scheme = match[0].toLowerCase();
    return schemes.some((allowed) => allowed.toLowerCase() === scheme) ? trimmed : undefined;
  }

  if (options.allowRelative === false) return undefined;
  // A relative reference cannot introduce a scheme, but reject anything that could be
  // reparsed as one (e.g. "java\nscript:alert(1)" once control characters are stripped).
  return SCHEME_PREFIX.test(trimmed) ? undefined : trimmed;
}

/** True when the value is safe to place in an `href`, `src` or pass to `Linking.openURL`. */
export function isSafeUrl(value: string | null | undefined, options?: ChatGateSanitizeUrlOptions): boolean {
  return sanitizeUrl(value, options) !== undefined;
}
