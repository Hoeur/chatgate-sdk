import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CHATGATE_COLOR_SCHEMES,
  CHATGATE_THEME_CSS_VARIABLES,
  createChatGateClient,
} from "@chatgate/core";
import {
  ChatGateConversation,
  ChatGateMessenger,
  ChatGateProvider,
  createChatGateThemeVariables,
} from "../dist/index.js";

function fakeClient() {
  return createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => ({ accessToken: "token", organizationId: "org-1", userId: "visitor-1" }),
    fetch: async () => ({ ok: true, status: 200, json: async () => ([]), text: async () => "[]" }),
    socketFactory: () => ({ connected: false, auth: {}, connect() { return this; }, disconnect() { return this; }, on() { return this; }, off() { return this; }, emit() { return this; } }),
  });
}

function render(Component, props) {
  return renderToStaticMarkup(
    React.createElement(
      ChatGateProvider,
      { client: fakeClient(), autoStart: false },
      React.createElement(Component, props),
    ),
  );
}

const COMPONENTS = [
  ["conversation", ChatGateConversation, { title: "Customer care" }],
  ["messenger", ChatGateMessenger, { title: "Merchant support" }],
];

// The colour tokens the palette owns. --cg-radius, --cg-font and
// --cg-sidebar-width are pre-existing non-colour tokens and are not part of a
// scheme, so they are excluded.
const COLOUR_VARS = Object.values(CHATGATE_THEME_CSS_VARIABLES);

/* --- light is unchanged ------------------------------------------- */

test("no theme at all renders no scheme attribute and no --cg-* declaration", () => {
  for (const [name, Component, props] of COMPONENTS) {
    const html = render(Component, props);
    assert.ok(!html.includes('data-cg-scheme="'), `${name} leaked a scheme attribute`);
    for (const cssVar of COLOUR_VARS) {
      assert.ok(!html.includes(`${cssVar}:`), `${name} emitted the scheme default ${cssVar}`);
    }
  }
});

test("colours without a colorScheme emit only those colours", () => {
  for (const [name, Component, props] of COMPONENTS) {
    const html = render(Component, { ...props, theme: { accentColor: "#7c3aed", dangerColor: "#dc2626" } });
    assert.match(html, /--cg-accent:#7c3aed/, name);
    assert.match(html, /--cg-danger:#dc2626/, name);
    assert.ok(!html.includes('data-cg-scheme="'), `${name} leaked a scheme attribute`);
    for (const cssVar of COLOUR_VARS) {
      if (cssVar === "--cg-accent" || cssVar === "--cg-danger") continue;
      assert.ok(!html.includes(`${cssVar}:`), `${name} emitted the scheme default ${cssVar}`);
    }
  }
});

test("the light literals survive as var() fallbacks in the markup", () => {
  const html = render(ChatGateConversation, { title: "Customer care" });
  // Graceful degradation path: no --cg-* is set, so each use site keeps its literal.
  assert.match(html, /var\(--cg-surface, #fff\)/);
  assert.match(html, /var\(--cg-text, #14213d\)/);
  assert.match(html, /var\(--cg-border, #d6e0ee\)/);
  assert.match(html, /var\(--cg-accent, #2563eb\)/);
});

test("the !important hover literals resolve through tokens", () => {
  const html = render(ChatGateConversation, { title: "Customer care" });
  assert.match(html, /background: var\(--cg-hover-strong, #e8effb\) !important/);
  assert.match(html, /background: var\(--cg-hover, #eff4fb\) !important/);
  // and no bare literal is left applied
  assert.ok(!/background: #e8effb !important/.test(html));
  assert.ok(!/background: #eff4fb !important/.test(html));
});

/* --- dark ---------------------------------------------------------- */

test("colorScheme dark marks the root and carries the dark token values", () => {
  for (const [name, Component, props] of COMPONENTS) {
    const html = render(Component, { ...props, theme: { colorScheme: "dark" } });
    assert.match(html, /data-cg-scheme="dark"/, name);
    assert.match(html, new RegExp(`--cg-surface:${CHATGATE_COLOR_SCHEMES.dark.surface}`), name);
    assert.match(html, new RegExp(`--cg-text:${CHATGATE_COLOR_SCHEMES.dark.text}`), name);
    assert.match(html, new RegExp(`--cg-accent:${CHATGATE_COLOR_SCHEMES.dark.accent}`), name);
  }
});

test("dark emits the complete token set, not only the supplied keys", () => {
  const vars = createChatGateThemeVariables({ colorScheme: "dark" });
  const expected = Object.keys(CHATGATE_COLOR_SCHEMES.dark).length;
  assert.equal(Object.keys(vars).filter((k) => k.startsWith("--cg-")).length, expected);
});

/* --- auto ---------------------------------------------------------- */

test("colorScheme auto marks the root and injects a prefers-color-scheme block", () => {
  for (const [name, Component, props] of COMPONENTS) {
    const html = render(Component, { ...props, theme: { colorScheme: "auto" } });
    assert.match(html, /data-cg-scheme="auto"/, name);
    assert.match(html, /@media \(prefers-color-scheme: dark\)/, name);
    assert.match(html, /\[data-cg-scheme=auto\]/, name);
    assert.match(html, new RegExp(`--cg-scheme-surface: ${CHATGATE_COLOR_SCHEMES.dark.surface};`), name);
    // The root's own tokens must indirect, or the media block could never win
    // over an inline declaration.
    assert.match(html, /--cg-surface:var\(--cg-scheme-surface\)/, name);
  }
});

/* --- consumer override ---------------------------------------------- */

test("an explicit token beats the scheme default in every scheme", () => {
  for (const scheme of [undefined, "light", "dark", "auto"]) {
    const theme = { accentColor: "#7c3aed" };
    if (scheme) theme.colorScheme = scheme;
    const html = render(ChatGateConversation, { title: "T", theme });
    assert.match(html, /--cg-accent:#7c3aed/, `accent override lost with colorScheme=${scheme}`);
    assert.ok(
      !html.includes(`--cg-accent:${CHATGATE_COLOR_SCHEMES.dark.accent}`),
      `scheme default overwrote the consumer accent with colorScheme=${scheme}`,
    );
    // Inside the auto media block the override must still win. The block only
    // defines --cg-scheme-*, and --cg-accent is pinned inline, so it does.
    if (scheme === "auto") {
      assert.ok(!html.includes("--cg-accent:var(--cg-scheme-accent)"));
    }
  }
});

/* --- explicit light -------------------------------------------------- */

test("colorScheme light marks the root and pins the light token set", () => {
  const html = render(ChatGateConversation, { title: "T", theme: { colorScheme: "light" } });
  assert.ok(html.includes('data-cg-scheme="light"'), "root is not marked as light");
  // Without the tokens actually written out, a light-requesting root cannot
  // reset a --cg-* an ancestor or the host page already defined.
  const emitted = createChatGateThemeVariables({ colorScheme: "light" });
  assert.deepEqual(
    Object.keys(emitted).sort(),
    Object.values(CHATGATE_THEME_CSS_VARIABLES).sort(),
  );
  assert.equal(emitted["--cg-surface"], CHATGATE_COLOR_SCHEMES.light.surface);
  assert.equal(emitted["--cg-text"], CHATGATE_COLOR_SCHEMES.light.text);
});

/* --- SSR ------------------------------------------------------------- */

test("every scheme renders server-side with no window, matchMedia or document", () => {
  assert.equal(typeof globalThis.window, "undefined");
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(typeof globalThis.matchMedia, "undefined");
  for (const scheme of ["light", "dark", "auto"]) {
    for (const [name, Component, props] of COMPONENTS) {
      const html = render(Component, { ...props, theme: { colorScheme: scheme } });
      assert.match(html, new RegExp(`data-cg-scheme="${scheme}"`), `${name}/${scheme}`);
    }
  }
});

/* --- no colour literal is applied directly ---------------------------- */

/** Replace every `var(--cg-x, fallback)` with a placeholder, parens balanced. */
function resolveTokens(css) {
  let out = css;
  for (;;) {
    const m = /var\(\s*--cg-[a-z-]+\s*,\s*/.exec(out);
    if (!m) return out;
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < out.length && depth > 0) {
      if (out[i] === "(") depth += 1;
      else if (out[i] === ")") depth -= 1;
      i += 1;
    }
    out = out.slice(0, m.index) + "TOKEN" + out.slice(i);
  }
}

/** The injected @media block is the scheme definition itself, not a use site. */
function withoutSchemeBlock(html) {
  return html.replace(/@media \(prefers-color-scheme: dark\)[\s\S]*?\n  \}\n/g, "");
}

const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

function literalsIn(html, declarationFilter) {
  const clean = resolveTokens(withoutSchemeBlock(html));
  const found = [];
  for (const decl of clean.match(/[a-z-]+\s*:\s*[^;"{}]+/g) ?? []) {
    const property = decl.slice(0, decl.indexOf(":")).trim();
    if (!declarationFilter(property)) continue;
    for (const lit of decl.match(LITERAL) ?? []) found.push(`${property}: ${lit}`);
  }
  return found;
}

const PAINT = ["background", "background-color", "color", "border", "border-top", "border-bottom", "border-left", "border-right"];
const TINT = ["box-shadow", "text-shadow", "outline"];
const IS_PAINT = (p) => PAINT.includes(p);
const IS_TINT = (p) => TINT.includes(p);

test("no background, colour or border literal is applied directly", () => {
  const offenders = [];
  for (const [name, Component, props] of COMPONENTS) {
    for (const hit of literalsIn(render(Component, props), IS_PAINT)) offenders.push(`${name}: ${hit}`);
  }
  assert.deepEqual(offenders, [], `\n${offenders.join("\n")}`);
});

test("no shadow or overlay tint is applied directly either", () => {
  const offenders = [];
  for (const [name, Component, props] of COMPONENTS) {
    for (const hit of literalsIn(render(Component, props), IS_TINT)) offenders.push(`${name}: ${hit}`);
  }
  assert.deepEqual(offenders, [], `\n${offenders.join("\n")}`);
});
