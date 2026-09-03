/**
 * Shared colour palette for every ChatGate adapter.
 *
 * The React and Vue packages compile these values down to `--cg-*` CSS custom
 * properties; React Native resolves them to plain values because it has no CSS.
 * Keeping the palette here is what stops the three adapters from drifting apart
 * whenever a token is added.
 *
 * This module is framework-free by design: it imports nothing and must stay
 * importable from plain Node.
 */

/**
 * Which palette the UI renders with.
 *
 * - `light` (default) — the historical appearance.
 * - `dark` — the dark palette.
 * - `auto` — follows the viewer: `prefers-color-scheme` on the web, the device
 *   appearance on React Native.
 */
export type ChatGateColorScheme = "light" | "dark" | "auto";

export type ChatGatePaletteKey =
  | "accent"
  | "accentHover"
  | "accentText"
  | "surface"
  | "canvas"
  | "text"
  | "muted"
  | "border"
  | "danger"
  | "dangerSurface"
  | "online"
  | "subtle"
  | "hover"
  | "hoverStrong"
  | "bubbleIn"
  | "shadow"
  | "roleCustomer"
  | "roleMerchant"
  | "roleAdmin";

export type ChatGatePalette = Record<ChatGatePaletteKey, string>;

/** The `--cg-*` custom property each palette key compiles to on the web. */
export const CHATGATE_THEME_CSS_VARIABLES: Record<ChatGatePaletteKey, string> = {
  accent: "--cg-accent",
  accentHover: "--cg-accent-hover",
  accentText: "--cg-accent-text",
  surface: "--cg-surface",
  canvas: "--cg-canvas",
  text: "--cg-text",
  muted: "--cg-muted",
  border: "--cg-border",
  danger: "--cg-danger",
  dangerSurface: "--cg-danger-surface",
  online: "--cg-online",
  subtle: "--cg-subtle",
  hover: "--cg-hover",
  hoverStrong: "--cg-hover-strong",
  bubbleIn: "--cg-bubble-in",
  shadow: "--cg-shadow",
  roleCustomer: "--cg-role-customer",
  roleMerchant: "--cg-role-merchant",
  roleAdmin: "--cg-role-admin",
};

const LIGHT: ChatGatePalette = {
  accent: "#2563eb",
  accentHover: "#1d4ed8",
  accentText: "#ffffff",
  surface: "#ffffff",
  canvas: "#f7f9fc",
  text: "#14213d",
  muted: "#64748b",
  border: "#dce5f1",
  danger: "#b91c1c",
  dangerSurface: "#fef2f2",
  online: "#22c55e",
  subtle: "#f8fafc",
  hover: "#eff4fb",
  hoverStrong: "#e8effb",
  bubbleIn: "#ffffff",
  shadow: "rgba(15,23,42,.10)",
  roleCustomer: "#475569",
  roleMerchant: "#0369a1",
  roleAdmin: "#7e22ce",
};

const DARK: ChatGatePalette = {
  accent: "#3b82f6",
  // On the accent, near-black clears AA at the 12.5px send-button size where
  // white (3.68:1) does not. Darkening the accent instead would drop the
  // button-against-surface ratio below the 3:1 UI-component rule.
  accentText: "#0b1220",
  accentHover: "#60a5fa",
  surface: "#111a2b",
  canvas: "#0b1220",
  text: "#e6edf7",
  muted: "#9fb0c9",
  border: "#3b4a63",
  danger: "#f87171",
  dangerSurface: "#3b1518",
  online: "#4ade80",
  subtle: "#182233",
  hover: "#1e293b",
  hoverStrong: "#273449",
  bubbleIn: "#1b2537",
  shadow: "rgba(0,0,0,.55)",
  roleCustomer: "#cbd5e1",
  roleMerchant: "#7dd3fc",
  roleAdmin: "#d8b4fe",
};

export const CHATGATE_COLOR_SCHEMES: { light: ChatGatePalette; dark: ChatGatePalette } = {
  light: LIGHT,
  dark: DARK,
};

/**
 * Collapse a requested scheme and the viewer's system preference into the
 * palette to render with. `auto` degrades to light when the system preference
 * is unknown, which is what happens during SSR and on hosts without the hook.
 */
export function resolveColorScheme(
  scheme?: ChatGateColorScheme,
  systemScheme?: "light" | "dark" | null,
): "light" | "dark" {
  if (scheme === "dark") return "dark";
  if (scheme === "auto") return systemScheme === "dark" ? "dark" : "light";
  return "light";
}

/** Backing variable a token indirects through in `auto` mode. */
function schemeVariable(key: ChatGatePaletteKey): string {
  return CHATGATE_THEME_CSS_VARIABLES[key].replace("--cg-", "--cg-scheme-");
}

/**
 * Build the `--cg-*` declarations for a web root element.
 *
 * The emission rule is what keeps an upgrade non-breaking:
 *
 * - A colour the consumer set is always emitted verbatim, so it wins in every
 *   scheme.
 * - When **no** scheme is chosen nothing else is emitted, so each use site keeps
 *   the per-site literal in its own `var(--cg-x, <literal>)` fallback. That is
 *   why upgrading without setting `colorScheme` renders identically to before.
 * - An explicit `light` does emit the full light set. It is a new opt-in value,
 *   so no existing consumer can regress, and emitting is what lets a widget
 *   placed inside a dark host page override `--cg-*` it would otherwise inherit.
 * - In `dark` the dark palette is emitted directly.
 * - In `auto` each token indirects through `var(--cg-scheme-x)`, which
 *   {@link createChatGateSchemeCss} defines only inside a
 *   `prefers-color-scheme: dark` block. While that media query does not match,
 *   the referenced variable is unset, which makes the declaration
 *   guaranteed-invalid and sends every use site to its own literal fallback —
 *   the same rendering as light.
 *
 * The indirection exists because inline styles outrank stylesheet rules: a
 * media query could never override an inline `--cg-accent` directly, but it can
 * define the variable that one points at.
 */
export function createChatGatePaletteVariables(
  scheme: ChatGateColorScheme | undefined,
  overrides: Partial<Record<ChatGatePaletteKey, string | undefined>> = {},
): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const key of Object.keys(CHATGATE_THEME_CSS_VARIABLES) as ChatGatePaletteKey[]) {
    const cssVariable = CHATGATE_THEME_CSS_VARIABLES[key];
    const override = overrides[key];
    if (override) {
      variables[cssVariable] = override;
      continue;
    }
    if (scheme === "dark") {
      variables[cssVariable] = DARK[key];
    } else if (scheme === "light") {
      variables[cssVariable] = LIGHT[key];
    } else if (scheme === "auto") {
      variables[cssVariable] = `var(${schemeVariable(key)})`;
    }
  }
  return variables;
}

/**
 * The `prefers-color-scheme: dark` block that powers `colorScheme: "auto"`.
 *
 * `selector` is the component's own attribute selector, so the block cannot
 * leak into an unrelated element on the host page.
 *
 * The `[data-cg-scheme=auto]` value is deliberately unquoted: Vue's SSR
 * serializer escapes `"` inside a `<style>` text child, which would turn a
 * quoted selector into `&quot;` and silently stop the block from matching.
 * `auto` is a valid CSS identifier, so unquoted is both safe and portable.
 */
export function createChatGateSchemeCss(selector: string): string {
  const declarations = (Object.keys(CHATGATE_THEME_CSS_VARIABLES) as ChatGatePaletteKey[])
    .map((key) => `      ${schemeVariable(key)}: ${DARK[key]};`)
    .join("\n");
  return `
  @media (prefers-color-scheme: dark) {
    ${selector}[data-cg-scheme=auto] {
${declarations}
    }
  }
`;
}
