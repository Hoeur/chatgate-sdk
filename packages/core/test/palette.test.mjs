import assert from "node:assert/strict";
import test from "node:test";
import {
  CHATGATE_COLOR_SCHEMES,
  CHATGATE_THEME_CSS_VARIABLES,
  createChatGatePaletteVariables,
  createChatGateSchemeCss,
  resolveColorScheme,
} from "../dist/index.js";

/* ------------------------------------------------------------------ *
 * WCAG relative luminance / contrast, implemented here so the numbers
 * the suite asserts on are computed, not copied from the palette.
 * ------------------------------------------------------------------ */

function channels(hex) {
  const raw = hex.trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  assert.match(full, /^[0-9a-fA-F]{6}$/, `not an opaque hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

function relativeLuminance(hex) {
  const [r, g, b] = channels(hex).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test("the contrast helper matches the WCAG reference values", () => {
  assert.equal(Number(contrastRatio("#000000", "#ffffff").toFixed(2)), 21);
  assert.equal(Number(contrastRatio("#ffffff", "#ffffff").toFixed(2)), 1);
  // Published reference pair: #767676 is the darkest grey that clears 4.5:1 on white.
  assert.ok(contrastRatio("#767676", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#777777", "#ffffff") < 4.5);
});

/* ------------------------------------------------------------------ *
 * Palette (shared): the three adapters cannot drift apart
 * ------------------------------------------------------------------ */

test("light and dark expose identical key sets", () => {
  const light = Object.keys(CHATGATE_COLOR_SCHEMES.light).sort();
  const dark = Object.keys(CHATGATE_COLOR_SCHEMES.dark).sort();
  assert.deepEqual(dark, light);
  assert.ok(light.length > 0);
});

test("every palette key has a --cg-* custom property and vice versa", () => {
  const paletteKeys = Object.keys(CHATGATE_COLOR_SCHEMES.light).sort();
  const variableKeys = Object.keys(CHATGATE_THEME_CSS_VARIABLES).sort();
  assert.deepEqual(variableKeys, paletteKeys);
  const names = Object.values(CHATGATE_THEME_CSS_VARIABLES);
  assert.equal(new Set(names).size, names.length, "duplicate --cg-* name");
  for (const name of names) assert.match(name, /^--cg-[a-z-]+$/);
});

test("every palette value in both schemes is an opaque colour or an rgba() shadow", () => {
  for (const scheme of ["light", "dark"]) {
    for (const [key, value] of Object.entries(CHATGATE_COLOR_SCHEMES[scheme])) {
      assert.match(value, /^(#[0-9a-f]{3,8}|rgba?\(.+\))$/i, `${scheme}.${key} = ${value}`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Contrast — dark-mode pairs the spec names, asserted numerically
 * ------------------------------------------------------------------ */

const AA_TEXT = 4.5;
const AA_UI = 3;

function ratio(scheme, fg, bg) {
  const p = CHATGATE_COLOR_SCHEMES[scheme];
  return contrastRatio(p[fg], p[bg]);
}

test("dark body text meets AA on every surface it is painted on", () => {
  for (const bg of ["surface", "canvas", "bubbleIn", "subtle", "hover", "hoverStrong"]) {
    const r = ratio("dark", "text", bg);
    assert.ok(r >= AA_TEXT, `dark text on ${bg} is ${r.toFixed(2)}:1, need ${AA_TEXT}`);
  }
});

test("dark muted text meets AA on every surface it is painted on", () => {
  for (const bg of ["surface", "canvas", "subtle", "hover"]) {
    const r = ratio("dark", "muted", bg);
    assert.ok(r >= AA_TEXT, `dark muted on ${bg} is ${r.toFixed(2)}:1, need ${AA_TEXT}`);
  }
});

test("the dark accent button meets AA for its label and 3:1 as a UI component", () => {
  const label = ratio("dark", "accentText", "accent");
  assert.ok(label >= AA_TEXT, `dark accentText on accent is ${label.toFixed(2)}:1`);
  for (const bg of ["surface", "canvas"]) {
    const r = ratio("dark", "accent", bg);
    assert.ok(r >= AA_UI, `dark accent on ${bg} is ${r.toFixed(2)}:1, need ${AA_UI}`);
  }
  const hover = ratio("dark", "accentHover", "surface");
  assert.ok(hover >= AA_UI, `dark accentHover on surface is ${hover.toFixed(2)}:1`);
});

test("dark danger, presence and role tokens meet their WCAG floor", () => {
  for (const bg of ["dangerSurface", "surface", "canvas"]) {
    const r = ratio("dark", "danger", bg);
    assert.ok(r >= AA_TEXT, `dark danger on ${bg} is ${r.toFixed(2)}:1, need ${AA_TEXT}`);
  }
  for (const bg of ["surface", "canvas"]) {
    const r = ratio("dark", "online", bg);
    assert.ok(r >= AA_UI, `dark online on ${bg} is ${r.toFixed(2)}:1, need ${AA_UI}`);
  }
  for (const role of ["roleCustomer", "roleMerchant", "roleAdmin"]) {
    const r = ratio("dark", role, "hover");
    assert.ok(r >= AA_TEXT, `dark ${role} on hover is ${r.toFixed(2)}:1, need ${AA_TEXT}`);
  }
});

test("the dark border is a visible divider (decorative, exempt from 3:1)", () => {
  // The spec amendment exempts plain dividers from the 3:1 rule, but a border
  // that is indistinguishable from its surface is a bug in any reading.
  for (const bg of ["surface", "canvas"]) {
    const r = ratio("dark", "border", bg);
    assert.ok(r > 1.2, `dark border on ${bg} is ${r.toFixed(2)}:1 — invisible`);
  }
});

/* ------------------------------------------------------------------ *
 * resolveColorScheme
 * ------------------------------------------------------------------ */

test("resolveColorScheme collapses a request and a system preference", () => {
  assert.equal(resolveColorScheme(undefined), "light");
  assert.equal(resolveColorScheme("light"), "light");
  assert.equal(resolveColorScheme("dark"), "dark");
  // an explicit scheme ignores the device
  assert.equal(resolveColorScheme("light", "dark"), "light");
  assert.equal(resolveColorScheme("dark", "light"), "dark");
  // auto follows the device
  assert.equal(resolveColorScheme("auto", "dark"), "dark");
  assert.equal(resolveColorScheme("auto", "light"), "light");
});

test("auto degrades to light when the system scheme is unknown", () => {
  for (const system of [undefined, null, "unspecified", "no-preference", ""]) {
    assert.equal(
      resolveColorScheme("auto", system),
      "light",
      `auto + ${JSON.stringify(system)} should degrade to light`,
    );
  }
});

/* ------------------------------------------------------------------ *
 * createChatGatePaletteVariables
 * ------------------------------------------------------------------ */

const ALL_VARS = Object.values(CHATGATE_THEME_CSS_VARIABLES).sort();

test("no scheme and no colours emits nothing, so light renders unchanged", () => {
  assert.deepEqual(createChatGatePaletteVariables(undefined), {});
  assert.deepEqual(createChatGatePaletteVariables(undefined, {}), {});
});

test("colours with no scheme emit only what the consumer supplied", () => {
  assert.deepEqual(createChatGatePaletteVariables(undefined, { accent: "#7c3aed" }), {
    "--cg-accent": "#7c3aed",
  });
});

test("dark emits the complete token set with the dark values", () => {
  const vars = createChatGatePaletteVariables("dark");
  assert.deepEqual(Object.keys(vars).sort(), ALL_VARS);
  for (const [key, cssVar] of Object.entries(CHATGATE_THEME_CSS_VARIABLES)) {
    assert.equal(vars[cssVar], CHATGATE_COLOR_SCHEMES.dark[key]);
  }
});

test("auto emits the complete token set, each indirecting through --cg-scheme-*", () => {
  const vars = createChatGatePaletteVariables("auto");
  assert.deepEqual(Object.keys(vars).sort(), ALL_VARS);
  for (const cssVar of ALL_VARS) {
    assert.equal(vars[cssVar], `var(${cssVar.replace("--cg-", "--cg-scheme-")})`);
  }
});

test("an explicit colour beats the scheme default in dark and in auto", () => {
  for (const scheme of ["dark", "auto", "light", undefined]) {
    const vars = createChatGatePaletteVariables(scheme, { accent: "#7c3aed", text: "#101828" });
    assert.equal(vars["--cg-accent"], "#7c3aed", `accent override lost in ${scheme}`);
    assert.equal(vars["--cg-text"], "#101828", `text override lost in ${scheme}`);
  }
});

test("an explicit light scheme emits the complete light token set", () => {
  // Acceptance criterion: "createChatGateThemeVariables emits a complete --cg-*
  // token set for the chosen scheme, not only the keys the consumer supplied."
  // "light" is one of the three schemes a consumer can choose.
  const vars = createChatGatePaletteVariables("light");
  assert.deepEqual(Object.keys(vars).sort(), ALL_VARS);
  for (const [key, cssVar] of Object.entries(CHATGATE_THEME_CSS_VARIABLES)) {
    assert.equal(vars[cssVar], CHATGATE_COLOR_SCHEMES.light[key]);
  }
});

/* ------------------------------------------------------------------ *
 * createChatGateSchemeCss
 * ------------------------------------------------------------------ */

test("the scheme stylesheet redefines every token behind a prefers-color-scheme query", () => {
  const css = createChatGateSchemeCss("[data-chatgate-conversation]");
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /\[data-chatgate-conversation\]\[data-cg-scheme=auto\]/);
  for (const [key, cssVar] of Object.entries(CHATGATE_THEME_CSS_VARIABLES)) {
    const backing = cssVar.replace("--cg-", "--cg-scheme-");
    assert.ok(
      css.includes(`${backing}: ${CHATGATE_COLOR_SCHEMES.dark[key]};`),
      `missing ${backing} in the dark media block`,
    );
  }
});

test("the scheme stylesheet is scoped to the selector it is given", () => {
  const css = createChatGateSchemeCss("[data-chatgate-messenger]");
  assert.ok(!css.includes("[data-chatgate-conversation]"));
  assert.ok(!css.includes(":root"));
  // No character that an HTML text-node serializer would escape inside <style>.
  assert.ok(!/[<>&"]/.test(css), "scheme CSS contains a character SSR would escape");
});
