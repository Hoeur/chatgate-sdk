import assert from "node:assert/strict";
import test from "node:test";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import {
  CHATGATE_COLOR_SCHEMES,
  CHATGATE_THEME_CSS_VARIABLES,
  createChatGateClient,
} from "@chatgate/core";
import {
  ChatGateConversation,
  ChatGateMessenger,
  createChatGatePlugin,
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

async function render(component, props) {
  const app = createSSRApp({ render: () => h(component, props) });
  app.use(createChatGatePlugin({ client: fakeClient(), autoStart: false }));
  return renderToString(app);
}

const COMPONENTS = [
  ["conversation", ChatGateConversation, { title: "Vue support" }],
  ["messenger", ChatGateMessenger, { title: "Merchant support" }],
];

// The colour tokens the palette owns. --cg-radius, --cg-font and
// --cg-sidebar-width are pre-existing non-colour tokens and are not part of a
// scheme, so they are excluded.
const COLOUR_VARS = Object.values(CHATGATE_THEME_CSS_VARIABLES);

/* --- light is unchanged ------------------------------------------- */

test("no theme at all renders no scheme attribute and no --cg-* declaration", async () => {
  for (const [name, component, props] of COMPONENTS) {
    const html = await render(component, props);
    assert.ok(!html.includes('data-cg-scheme="'), `${name} leaked a scheme attribute`);
    for (const cssVar of COLOUR_VARS) {
      assert.ok(!html.includes(`${cssVar}:`), `${name} emitted the scheme default ${cssVar}`);
    }
  }
});

test("colours without a colorScheme emit only those colours", async () => {
  for (const [name, component, props] of COMPONENTS) {
    const html = await render(component, { ...props, theme: { accentColor: "#7c3aed", dangerColor: "#dc2626" } });
    assert.match(html, /--cg-accent:#7c3aed/, name);
    assert.match(html, /--cg-danger:#dc2626/, name);
    assert.ok(!html.includes('data-cg-scheme="'), `${name} leaked a scheme attribute`);
    for (const cssVar of COLOUR_VARS) {
      if (cssVar === "--cg-accent" || cssVar === "--cg-danger") continue;
      assert.ok(!html.includes(`${cssVar}:`), `${name} emitted the scheme default ${cssVar}`);
    }
  }
});

test("the !important hover literal resolves through a token", async () => {
  const html = await render(ChatGateConversation, { title: "Vue support" });
  assert.match(html, /background: var\(--cg-hover, #eff4fb\) !important/);
  assert.ok(!/background: #eff4fb !important/.test(html));
});

/* --- dark ---------------------------------------------------------- */

test("colorScheme dark marks the root and carries the dark token values", async () => {
  for (const [name, component, props] of COMPONENTS) {
    const html = await render(component, { ...props, theme: { colorScheme: "dark" } });
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

test("colorScheme auto marks the root and injects a prefers-color-scheme block", async () => {
  for (const [name, component, props] of COMPONENTS) {
    const html = await render(component, { ...props, theme: { colorScheme: "auto" } });
    assert.match(html, /data-cg-scheme="auto"/, name);
    assert.match(html, /@media \(prefers-color-scheme: dark\)/, name);
    assert.match(html, /\[data-cg-scheme=auto\]/, name);
    assert.match(html, new RegExp(`--cg-scheme-surface: ${CHATGATE_COLOR_SCHEMES.dark.surface};`), name);
    assert.match(html, /--cg-surface:var\(--cg-scheme-surface\)/, name);
  }
});

test("the injected stylesheet survives Vue's SSR text escaping", async () => {
  for (const [name, component, props] of COMPONENTS) {
    const html = await render(component, { ...props, theme: { colorScheme: "auto" } });
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
    assert.ok(styles.length > 0, `${name} rendered no <style> element`);
    const scheme = styles.find((s) => s.includes("prefers-color-scheme"));
    assert.ok(scheme, `${name} rendered no scheme block`);
    assert.ok(!/&(quot|amp|lt|gt|#\d+|#x[0-9a-fA-F]+);/.test(scheme),
      `${name} scheme block was HTML-escaped: ${scheme.slice(0, 160)}`);
  }
});

/* --- consumer override ---------------------------------------------- */

test("an explicit token beats the scheme default in every scheme", async () => {
  for (const scheme of [undefined, "light", "dark", "auto"]) {
    const theme = { accentColor: "#7c3aed" };
    if (scheme) theme.colorScheme = scheme;
    const html = await render(ChatGateConversation, { title: "T", theme });
    assert.match(html, /--cg-accent:#7c3aed/, `accent override lost with colorScheme=${scheme}`);
    assert.ok(
      !html.includes(`--cg-accent:${CHATGATE_COLOR_SCHEMES.dark.accent}`),
      `scheme default overwrote the consumer accent with colorScheme=${scheme}`,
    );
    if (scheme === "auto") assert.ok(!html.includes("--cg-accent:var(--cg-scheme-accent)"));
  }
});

/* --- explicit light -------------------------------------------------- */

test("colorScheme light marks the root and pins the light token set", async () => {
  const html = await render(ChatGateConversation, { title: "T", theme: { colorScheme: "light" } });
  assert.ok(html.includes('data-cg-scheme="light"'), "root is not marked as light");
  const emitted = createChatGateThemeVariables({ colorScheme: "light" });
  assert.deepEqual(
    Object.keys(emitted).sort(),
    Object.values(CHATGATE_THEME_CSS_VARIABLES).sort(),
  );
  assert.equal(emitted["--cg-surface"], CHATGATE_COLOR_SCHEMES.light.surface);
  assert.equal(emitted["--cg-text"], CHATGATE_COLOR_SCHEMES.light.text);
});

/* --- SSR ------------------------------------------------------------- */

test("every scheme renders server-side with no window, matchMedia or document", async () => {
  assert.equal(typeof globalThis.window, "undefined");
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(typeof globalThis.matchMedia, "undefined");
  for (const scheme of ["light", "dark", "auto"]) {
    for (const [name, component, props] of COMPONENTS) {
      const html = await render(component, { ...props, theme: { colorScheme: scheme } });
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

test("no background, colour or border literal is applied directly", async () => {
  const offenders = [];
  for (const [name, component, props] of COMPONENTS) {
    for (const hit of literalsIn(await render(component, props), IS_PAINT)) offenders.push(`${name}: ${hit}`);
  }
  assert.deepEqual(offenders, [], `\n${offenders.join("\n")}`);
});

test("no shadow or overlay tint is applied directly either", async () => {
  const offenders = [];
  for (const [name, component, props] of COMPONENTS) {
    for (const hit of literalsIn(await render(component, props), IS_TINT)) offenders.push(`${name}: ${hit}`);
  }
  assert.deepEqual(offenders, [], `\n${offenders.join("\n")}`);
});
