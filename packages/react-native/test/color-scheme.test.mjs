import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CHATGATE_COLOR_SCHEMES } from "@chatgate/core";
// theme.js is framework-free (it imports @chatgate/core only), so it can be
// exercised directly. dist/index.js pulls in react-native and is read as text,
// which is how this package's suite has always worked.
import { resolveChatGateTheme } from "../dist/theme.js";

const read = (name) => readFile(new URL(`../dist/${name}`, import.meta.url), "utf8");

/* --- WCAG helpers, computed here rather than copied ------------------ */

function relativeLuminance(hex) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* --- the 0.6.4 defaults, transcribed from the released theme.ts ------ */

const LEGACY_LIGHT = {
  accent: "#0e9f6e",
  accentText: "#ffffff",
  accentDark: "#0c8a5f",
  accentSoft: "#d6f1e5",
  canvas: "#f7f9fc",
  surface: "#ffffff",
  border: "#dce5f1",
  text: "#0f172a",
  muted: "#64748b",
  incoming: "#eff4fa",
  radius: 16,
  danger: "#b91c1c",
  online: "#22c55e",
};

/* --- light unchanged -------------------------------------------------- */

function driftFrom064(resolved) {
  return Object.entries(LEGACY_LIGHT)
    .filter(([key, value]) => resolved[key] !== value)
    .map(([key, value]) => `${key}: 0.6.4 rendered ${value}, now renders ${resolved[key]}`);
}

test("no theme keeps every 0.6.4 light default", () => {
  assert.deepEqual(driftFrom064(resolveChatGateTheme()), []);
});

test("an explicit light scheme keeps every 0.6.4 light default", () => {
  assert.deepEqual(driftFrom064(resolveChatGateTheme({ colorScheme: "light" })), []);
});

test("the error-banner surface keeps the literal it replaced", () => {
  assert.equal(resolveChatGateTheme().dangerSurface, "#fef2f2");
});

/* --- dark ------------------------------------------------------------- */

test("colorScheme dark returns the shared dark neutrals", () => {
  const t = resolveChatGateTheme({ colorScheme: "dark" });
  const dark = CHATGATE_COLOR_SCHEMES.dark;
  assert.equal(t.surface, dark.surface);
  assert.equal(t.canvas, dark.canvas);
  assert.equal(t.text, dark.text);
  assert.equal(t.muted, dark.muted);
  assert.equal(t.border, dark.border);
  assert.equal(t.danger, dark.danger);
  assert.equal(t.online, dark.online);
  assert.equal(t.dangerSurface, dark.dangerSurface);
  assert.notEqual(t.accent, resolveChatGateTheme().accent, "the accent did not change in dark");
});

/* --- auto ------------------------------------------------------------- */

test("auto follows the device scheme", () => {
  assert.equal(resolveChatGateTheme({ colorScheme: "auto" }, "dark").surface, CHATGATE_COLOR_SCHEMES.dark.surface);
  assert.equal(resolveChatGateTheme({ colorScheme: "auto" }, "light").surface, LEGACY_LIGHT.surface);
});

test("auto degrades to light when the device scheme is absent, null or unrecognised", () => {
  for (const system of [undefined, null, "unspecified", "no-preference"]) {
    const t = resolveChatGateTheme({ colorScheme: "auto" }, system);
    assert.equal(t.surface, LEGACY_LIGHT.surface, `auto + ${JSON.stringify(system)}`);
    assert.equal(t.canvas, LEGACY_LIGHT.canvas, `auto + ${JSON.stringify(system)}`);
    assert.equal(t.accent, LEGACY_LIGHT.accent, `auto + ${JSON.stringify(system)}`);
  }
});

test("an explicit scheme ignores the device", () => {
  assert.equal(resolveChatGateTheme({ colorScheme: "dark" }, "light").surface, CHATGATE_COLOR_SCHEMES.dark.surface);
  assert.equal(resolveChatGateTheme({ colorScheme: "light" }, "dark").surface, LEGACY_LIGHT.surface);
  assert.equal(resolveChatGateTheme(undefined, "dark").surface, LEGACY_LIGHT.surface);
});

/* --- consumer override ------------------------------------------------ */

test("an explicit colour beats the scheme default in every scheme", () => {
  for (const scheme of [undefined, "light", "dark", "auto"]) {
    const theme = { accentColor: "#7c3aed", textColor: "#101828" };
    if (scheme) theme.colorScheme = scheme;
    for (const system of ["light", "dark", null]) {
      const t = resolveChatGateTheme(theme, system);
      assert.equal(t.accent, "#7c3aed", `accent lost with ${scheme}/${system}`);
      assert.equal(t.text, "#101828", `text lost with ${scheme}/${system}`);
    }
  }
});

/* --- contrast --------------------------------------------------------- */

test("the dark React Native palette meets WCAG AA where the spec requires it", () => {
  const t = resolveChatGateTheme({ colorScheme: "dark" });
  const pairs = [
    ["body text on surface", t.text, t.surface, 4.5],
    ["body text on canvas", t.text, t.canvas, 4.5],
    ["body text on incoming bubble", t.text, t.incoming, 4.5],
    ["muted text on surface", t.muted, t.surface, 4.5],
    ["muted text on canvas", t.muted, t.canvas, 4.5],
    ["accent button label", t.accentText, t.accent, 4.5],
    ["accent button on surface", t.accent, t.surface, 3],
    ["accent button on canvas", t.accent, t.canvas, 3],
    ["danger text on danger surface", t.danger, t.dangerSurface, 4.5],
    ["danger text on surface", t.danger, t.surface, 4.5],
    ["presence dot on surface", t.online, t.surface, 3],
  ];
  for (const [label, fg, bg, floor] of pairs) {
    const r = contrastRatio(fg, bg);
    assert.ok(r >= floor, `${label}: ${fg} on ${bg} is ${r.toFixed(2)}:1, need ${floor}`);
  }
});

/* --- API surface and dependencies ------------------------------------- */

test("colorScheme is declared, optional, and the resolved type is public", async () => {
  const themeTypes = await read("theme.d.ts");
  assert.match(themeTypes, /colorScheme\?: ChatGateColorScheme;/);
  assert.match(themeTypes, /dangerSurface: string;/);
  // Every pre-existing ChatGateTheme field is still there and still optional.
  for (const field of [
    "accentColor?:", "accentTextColor?:", "accentDarkColor?:", "accentSoftColor?:",
    "canvasColor?:", "surfaceColor?:", "borderColor?:", "textColor?:",
    "mutedTextColor?:", "incomingBubbleColor?:", "borderRadius?:",
    "dangerColor?:", "onlineColor?:",
  ]) {
    assert.ok(themeTypes.includes(field), `missing ${field}`);
  }
  const indexTypes = await read("index.d.ts");
  assert.match(indexTypes, /ResolvedChatGateTheme/);
});

test("auto is wired to React Native's own useColorScheme, adding no dependency", async () => {
  for (const file of ["conversation.js", "messenger.js"]) {
    const source = await read(file);
    assert.match(source, /useColorScheme/, `${file} never reads the device scheme`);
    assert.match(source, /from ["']react-native["']/, `${file} stopped importing react-native`);
  }
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies, undefined, "react-native gained a runtime dependency");
  assert.deepEqual(Object.keys(pkg.peerDependencies).sort(), ["@chatgate/core", "react", "react-native"]);
});

test("the error banners resolve through the theme instead of a literal", async () => {
  for (const file of ["conversation.js", "messenger.js"]) {
    const source = await read(file);
    assert.ok(!source.includes("#fef2f2"), `${file} still applies the #fef2f2 literal`);
  }
});
