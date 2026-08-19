import assert from "node:assert/strict";
import test from "node:test";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import { createChatGateClient } from "@chatgate/core";
import {
  ChatGate,
  ChatGateConversation,
  ChatGateMessenger,
  ChatGateProvider,
  createChatGatePlugin,
  createChatGateThemeVariables,
} from "../dist/index.js";

function stubClient(overrides = {}) {
  return createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => ({ accessToken: "token", organizationId: "org-1", userId: "visitor-1" }),
    fetch: async () => ({ ok: true, status: 200, json: async () => ([]), text: async () => "[]" }),
    socketFactory: () => ({ connected: false, auth: {}, connect() { return this; }, disconnect() { return this; }, on() { return this; }, off() { return this; }, emit() { return this; } }),
    ...overrides,
  });
}

test("renders the Vue chat UI without starting sockets during SSR", async () => {
  let socketFactoryCalls = 0;
  let sessionCalls = 0;
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => {
      sessionCalls += 1;
      return { accessToken: "token", organizationId: "org-1", userId: "visitor-1" };
    },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "{}" }),
    socketFactory: () => {
      socketFactoryCalls += 1;
      return { connected: false, auth: {}, connect() { return this; }, disconnect() { return this; }, on() { return this; }, off() { return this; }, emit() { return this; } };
    },
  });
  const app = createSSRApp({ render: () => h(ChatGateConversation, { title: "Vue support" }) });
  app.use(createChatGatePlugin({ client }));

  const html = await renderToString(app);
  assert.match(html, /Vue support/);
  assert.match(html, /No messages yet/);
  assert.match(html, /aria-label="Message"/);
  assert.equal(socketFactoryCalls, 0);
  assert.equal(sessionCalls, 0);
});

test("renders the Vue merchant conversation navigator during SSR", async () => {
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => ({ accessToken: "token", organizationId: "org-1", userId: "visitor-1" }),
    fetch: async () => ({ ok: true, status: 200, json: async () => ([]), text: async () => "[]" }),
    socketFactory: () => ({ connected: false, auth: {}, connect() { return this; }, disconnect() { return this; }, on() { return this; }, off() { return this; }, emit() { return this; } }),
  });
  const app = createSSRApp({ render: () => h(ChatGateMessenger, { title: "Merchant support" }) });
  app.use(createChatGatePlugin({ client, autoStart: false }));

  const html = await renderToString(app);
  assert.match(html, /Merchant support/);
  assert.match(html, /No conversations yet/);
});

test("compiles theme tokens into --cg-* custom properties", () => {
  assert.deepEqual(createChatGateThemeVariables(undefined), {});
  assert.deepEqual(
    createChatGateThemeVariables({ accentColor: "#7c3aed", borderRadius: 12, fontFamily: "Inter" }),
    { "--cg-accent": "#7c3aed", "--cg-radius": "12px", "--cg-font": "Inter" },
  );
});

test("applies the theme prop and label overrides", async () => {
  const app = createSSRApp({
    render: () => h(ChatGateMessenger, {
      title: "Boutique",
      theme: { accentColor: "#7c3aed", borderRadius: 8 },
      labels: { noConversations: "Aucune conversation", searchPlaceholder: "Rechercher" },
    }),
  });
  app.use(createChatGatePlugin({ client: stubClient(), autoStart: false }));

  const html = await renderToString(app);
  assert.match(html, /--cg-accent:#7c3aed/);
  assert.match(html, /--cg-radius:8px/);
  assert.match(html, /Aucune conversation/);
  assert.match(html, /Rechercher/);
  assert.doesNotMatch(html, /No conversations yet/);
});

test("renders a custom empty state instead of the default panel", async () => {
  const app = createSSRApp({
    render: () => h(ChatGateConversation, {
      title: "Support",
      emptyState: () => h("p", "Ask us anything"),
    }),
  });
  app.use(createChatGatePlugin({ client: stubClient(), autoStart: false }));

  const html = await renderToString(app);
  assert.match(html, /Ask us anything/);
  assert.doesNotMatch(html, /No messages yet/);
});

test("ChatGateProvider scopes the client to its subtree", async () => {
  const client = stubClient();
  const app = createSSRApp({
    render: () => h(
      ChatGateProvider,
      { client, autoStart: false },
      { default: () => h(ChatGateConversation, { title: "Scoped support" }) },
    ),
  });

  const html = await renderToString(app);
  assert.match(html, /Scoped support/);
});

test("ChatGate builds its own client from a publishable key", async () => {
  const app = createSSRApp({
    render: () => h(ChatGate, {
      publicKey: "cg_pk_test",
      baseUrl: "https://api.example.test",
      title: "Widget support",
      autoStart: false,
    }),
  });

  const html = await renderToString(app);
  assert.match(html, /Widget support/);
});
