import {
  CHATGATE_COLOR_SCHEMES,
  resolveColorScheme,
  type ChatGateColorScheme,
} from "@chatgate/core";

/**
 * Themeable palette for the React Native messenger + conversation UI, mirroring
 * the customization surface of `@chatgate/react`. Pass a `theme` prop to
 * `ChatGateMessenger` / `ChatGateConversation`; anything omitted falls back to
 * the defaults below.
 */
export interface ChatGateTheme {
  /** Primary brand colour: header, own bubble, send button, avatars, unread. */
  accentColor?: string;
  /** Text/icon colour on top of the accent (usually white). */
  accentTextColor?: string;
  /** A darker accent for pressed states, links and icons. */
  accentDarkColor?: string;
  /** A soft accent tint for reply banners and muted on-accent text. */
  accentSoftColor?: string;
  /** Body / list background. */
  canvasColor?: string;
  /** Cards, rows, composer and bubbles background. */
  surfaceColor?: string;
  borderColor?: string;
  /** Primary text colour. */
  textColor?: string;
  /** Secondary / muted text colour. */
  mutedTextColor?: string;
  /** Incoming (other participant) bubble background. */
  incomingBubbleColor?: string;
  /** Outer corner radius of the widget. */
  borderRadius?: number;
  /** Error / recording / destructive elements. */
  dangerColor?: string;
  /** Presence / online indicator. */
  onlineColor?: string;
  /**
   * Which palette to render with. Omitted (the default) keeps the historical
   * light appearance; `"dark"` renders the dark palette; `"auto"` follows the
   * device appearance. Any colour set above still wins over the scheme.
   */
  colorScheme?: ChatGateColorScheme;
}

export interface ResolvedChatGateTheme {
  accent: string;
  accentText: string;
  accentDark: string;
  accentSoft: string;
  canvas: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  incoming: string;
  radius: number;
  danger: string;
  /** Background behind destructive banners, paired with `danger`. */
  dangerSurface: string;
  online: string;
}

/**
 * The accent family stays local to React Native: this package has always shipped
 * a green brand accent while the web packages ship blue, and reconciling the two
 * is a separate decision. Only the neutrals come from the shared palette, which
 * is where drift between the adapters would actually be felt.
 *
 * Dark values are chosen against the dark surface (#111a2b): accent 9.05:1,
 * accentDark 6.38:1, and near-black `accentText` on the accent 9.74:1 — white on
 * a light green reads 1.92:1 and fails, which is why the on-accent text flips.
 */
const ACCENTS = {
  light: { accent: "#0e9f6e", accentText: "#ffffff", accentDark: "#0c8a5f", accentSoft: "#d6f1e5" },
  dark: { accent: "#34d399", accentText: "#0b1220", accentDark: "#25b184", accentSoft: "#143b2f" },
} as const;

/**
 * Light neutrals are RN's own historical values, not the shared light palette.
 * They differ from React/Vue in two places that predate this change — `text`
 * (#0f172a vs #14213d) and the incoming bubble (#eff4fa vs #ffffff) — and
 * adopting the shared values would silently restyle every existing app that
 * sets no theme. Dark comes from the shared palette, because dark is new and
 * has no installed base to preserve.
 */
const NEUTRALS = {
  light: {
    canvas: "#f7f9fc",
    surface: "#ffffff",
    border: "#dce5f1",
    text: "#0f172a",
    muted: "#64748b",
    bubbleIn: "#eff4fa",
    danger: "#b91c1c",
    dangerSurface: "#fef2f2",
    online: "#22c55e",
  },
  dark: CHATGATE_COLOR_SCHEMES.dark,
} as const;

/**
 * Resolve a theme to concrete values. `systemScheme` is the device appearance —
 * pass `useColorScheme()` from the component. It is optional so existing call
 * sites keep working, and `auto` degrades to light when it is absent.
 */
export function resolveChatGateTheme(
  theme?: ChatGateTheme,
  systemScheme?: "light" | "dark" | null,
): ResolvedChatGateTheme {
  const scheme = resolveColorScheme(theme?.colorScheme, systemScheme);
  const palette = NEUTRALS[scheme];
  const accents = ACCENTS[scheme];
  return {
    accent: theme?.accentColor ?? accents.accent,
    accentText: theme?.accentTextColor ?? accents.accentText,
    accentDark: theme?.accentDarkColor ?? accents.accentDark,
    accentSoft: theme?.accentSoftColor ?? accents.accentSoft,
    canvas: theme?.canvasColor ?? palette.canvas,
    surface: theme?.surfaceColor ?? palette.surface,
    border: theme?.borderColor ?? palette.border,
    text: theme?.textColor ?? palette.text,
    muted: theme?.mutedTextColor ?? palette.muted,
    incoming: theme?.incomingBubbleColor ?? palette.bubbleIn,
    radius: theme?.borderRadius ?? 16,
    danger: theme?.dangerColor ?? palette.danger,
    dangerSurface: palette.dangerSurface,
    online: theme?.onlineColor ?? palette.online,
  };
}

/** Compact relative timestamp for conversation-list rows (now, 5m, 3h, Mon…). */
export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const min = 60_000;
  const hr = 3_600_000;
  const day = 86_400_000;
  if (diff < min) return "now";
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hr)}h`;
  const date = new Date(then);
  if (diff < 7 * day) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
