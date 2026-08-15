import assert from "node:assert/strict";
import test from "node:test";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import { createChatGateClient } from "@chatgate/core";
import { ChatGateConversation, ChatGateMessenger, createChatGatePlugin } from "../dist/index.js";

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
