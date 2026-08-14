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
  online: string;
}

export function resolveChatGateTheme(theme?: ChatGateTheme): ResolvedChatGateTheme {
  return {
    accent: theme?.accentColor ?? "#0e9f6e",
    accentText: theme?.accentTextColor ?? "#ffffff",
    accentDark: theme?.accentDarkColor ?? "#0c8a5f",
    accentSoft: theme?.accentSoftColor ?? "#d6f1e5",
    canvas: theme?.canvasColor ?? "#f7f9fc",
    surface: theme?.surfaceColor ?? "#ffffff",
    border: theme?.borderColor ?? "#dce5f1",
    text: theme?.textColor ?? "#0f172a",
    muted: theme?.mutedTextColor ?? "#64748b",
    incoming: theme?.incomingBubbleColor ?? "#eff4fa",
    radius: theme?.borderRadius ?? 16,
    danger: "#b91c1c",
    online: "#22c55e",
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
