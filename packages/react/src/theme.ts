import type { CSSProperties } from "react";
import {
  createChatGatePaletteVariables,
  type ChatGateColorScheme,
} from "@chatgate/core";

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
  /**
   * Which palette to render with. Omitted (the default) keeps the historical
   * light appearance; `"dark"` emits the dark palette; `"auto"` follows the
   * viewer's `prefers-color-scheme`. Any colour set above still wins over the
   * scheme in every mode.
   */
  colorScheme?: ChatGateColorScheme;
}

type ChatGateThemeVariables = CSSProperties & Record<`--cg-${string}`, string>;

export function createChatGateThemeVariables(
  theme: ChatGateTheme | undefined,
): ChatGateThemeVariables {
  const variables = {} as ChatGateThemeVariables;
  if (!theme) return variables;
  Object.assign(variables, createChatGatePaletteVariables(theme.colorScheme, {
    accent: theme.accentColor,
    accentHover: theme.accentHoverColor,
    accentText: theme.accentTextColor,
    surface: theme.surfaceColor,
    canvas: theme.canvasColor,
    text: theme.textColor,
    muted: theme.mutedTextColor,
    border: theme.borderColor,
    danger: theme.dangerColor,
    online: theme.onlineColor,
  }));
  if (theme.borderRadius !== undefined) {
    variables["--cg-radius"] = typeof theme.borderRadius === "number"
      ? `${theme.borderRadius}px`
      : theme.borderRadius;
  }
  if (theme.fontFamily) variables["--cg-font"] = theme.fontFamily;
  return variables;
}
