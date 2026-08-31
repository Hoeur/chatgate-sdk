import type { CSSProperties } from "vue";

/**
 * Branding tokens for the Vue components. They compile down to the same
 * `--cg-*` custom properties the components read, so a `theme` prop and a
 * hand-written CSS variable block are interchangeable.
 */
export interface ChatGateTheme {
  accentColor?: string;
  accentHoverColor?: string;
  accentTextColor?: string;
  surfaceColor?: string;
  canvasColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  borderColor?: string;
  borderRadius?: number | string;
  fontFamily?: string;
  dangerColor?: string;
  onlineColor?: string;
}

type ChatGateThemeVariables = CSSProperties & Record<`--cg-${string}`, string>;

export function createChatGateThemeVariables(
  theme: ChatGateTheme | undefined,
): ChatGateThemeVariables {
  const variables = {} as ChatGateThemeVariables;
  if (!theme) return variables;
  if (theme.accentColor) variables["--cg-accent"] = theme.accentColor;
  if (theme.accentHoverColor) variables["--cg-accent-hover"] = theme.accentHoverColor;
  if (theme.accentTextColor) variables["--cg-accent-text"] = theme.accentTextColor;
  if (theme.surfaceColor) variables["--cg-surface"] = theme.surfaceColor;
  if (theme.canvasColor) variables["--cg-canvas"] = theme.canvasColor;
  if (theme.textColor) variables["--cg-text"] = theme.textColor;
  if (theme.mutedTextColor) variables["--cg-muted"] = theme.mutedTextColor;
  if (theme.borderColor) variables["--cg-border"] = theme.borderColor;
  if (theme.borderRadius !== undefined) {
    variables["--cg-radius"] = typeof theme.borderRadius === "number"
      ? `${theme.borderRadius}px`
      : theme.borderRadius;
  }
  if (theme.fontFamily) variables["--cg-font"] = theme.fontFamily;
  if (theme.dangerColor) variables["--cg-danger"] = theme.dangerColor;
  if (theme.onlineColor) variables["--cg-online"] = theme.onlineColor;
  return variables;
}
