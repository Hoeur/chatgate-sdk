import type { CSSProperties } from "vue";
import {
  createChatGatePaletteVariables,
  type ChatGateColorScheme,
} from "@chatgate/core";

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
  /**
   * Which palette to render with. Omitted (or `"light"`) keeps the historical
   * appearance; `"dark"` renders the dark palette; `"auto"` follows
   * `prefers-color-scheme`. Any colour set above still wins in every scheme.
   */
  colorScheme?: ChatGateColorScheme;
}

type ChatGateThemeVariables = CSSProperties & Record<`--cg-${string}`, string>;

/**
 * Compile a theme into the `--cg-*` declarations for a component root.
 *
 * The colour tokens are delegated to `@chatgate/core` so React, Vue and React
 * Native cannot drift apart. Only the two non-colour tokens (`--cg-radius`,
 * `--cg-font`) are resolved here, and their emission is unchanged: they are
 * written when the consumer sets them and omitted otherwise.
 */
export function createChatGateThemeVariables(
  theme: ChatGateTheme | undefined,
): ChatGateThemeVariables {
  const variables = Object.assign(
    {} as ChatGateThemeVariables,
    createChatGatePaletteVariables(theme?.colorScheme, {
      accent: theme?.accentColor,
      accentHover: theme?.accentHoverColor,
      accentText: theme?.accentTextColor,
      surface: theme?.surfaceColor,
      canvas: theme?.canvasColor,
      text: theme?.textColor,
      muted: theme?.mutedTextColor,
      border: theme?.borderColor,
      danger: theme?.dangerColor,
      online: theme?.onlineColor,
    }),
  );
  if (theme?.borderRadius !== undefined) {
    variables["--cg-radius"] = typeof theme.borderRadius === "number"
      ? `${theme.borderRadius}px`
      : theme.borderRadius;
  }
  if (theme?.fontFamily) variables["--cg-font"] = theme.fontFamily;
  return variables;
}
